/**
 * Migration script: DynamoDB → Firestore + S3 → Cloud Storage
 *
 * Usage:
 *   node scripts/migrate-dynamodb-to-firestore.js
 *
 * Required environment variables:
 *   AWS_REGION                  - AWS region (e.g., us-west-2)
 *   AWS_ACCESS_KEY_ID           - AWS credentials
 *   AWS_SECRET_ACCESS_KEY       - AWS credentials
 *   GCP_PROJECT_ID              - GCP project ID
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to GCP service account key
 *   SOURCE_PHOTOS_BUCKET        - S3 bucket name for photos
 *   TARGET_PHOTOS_BUCKET        - GCS bucket name for photos
 *   OLD_CLOUDFRONT_DOMAIN       - CloudFront domain to find/replace in URLs
 *   NEW_PHOTOS_BASE_URL         - GCS base URL (e.g., https://storage.googleapis.com/<bucket>)
 *
 * Optional:
 *   USERS_TABLE_NAME            - (default: ExpenseSplitter-Users)
 *   GROUPS_TABLE_NAME           - (default: ExpenseSplitter-Groups)
 *   EXPENSES_TABLE_NAME         - (default: ExpenseSplitter-Expenses)
 *   SETTLEMENTS_TABLE_NAME      - (default: ExpenseSplitter-Settlements)
 *   DRY_RUN=true                - Only count records, don't write
 */

require('dotenv').config();

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');

// AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// GCP clients
const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage();

const DRY_RUN = process.env.DRY_RUN === 'true';

const TABLE_MAP = {
  [process.env.USERS_TABLE_NAME || 'ExpenseSplitter-Users']: 'users',
  [process.env.GROUPS_TABLE_NAME || 'ExpenseSplitter-Groups']: 'groups',
  [process.env.EXPENSES_TABLE_NAME || 'ExpenseSplitter-Expenses']: 'expenses',
  [process.env.SETTLEMENTS_TABLE_NAME || 'ExpenseSplitter-Settlements']: 'settlements',
};

const OLD_DOMAIN = process.env.OLD_CLOUDFRONT_DOMAIN;
const NEW_BASE_URL = process.env.NEW_PHOTOS_BASE_URL;

/**
 * Scan all items from a DynamoDB table (handles pagination)
 */
async function scanAllItems(tableName) {
  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = { TableName: tableName };
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new ScanCommand(params));
    if (result.Items) {
      items.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Rewrite CloudFront URLs to GCS URLs in a document
 */
function rewriteUrls(obj) {
  if (!OLD_DOMAIN || !NEW_BASE_URL) return obj;

  const json = JSON.stringify(obj);
  const rewritten = json.replace(
    new RegExp(`https://${OLD_DOMAIN.replace(/\./g, '\\.')}`, 'g'),
    NEW_BASE_URL
  );
  return JSON.parse(rewritten);
}

/**
 * Migrate a DynamoDB table to a Firestore collection
 */
async function migrateTable(tableName, collectionName) {
  console.log(`\n--- Migrating ${tableName} → ${collectionName} ---`);

  const items = await scanAllItems(tableName);
  console.log(`  Found ${items.length} items in DynamoDB`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping writes');
    return items.length;
  }

  // Firestore batch writes (max 500 per batch)
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = items.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const rewritten = rewriteUrls(item);
      const docId = rewritten.id;

      if (!docId) {
        console.warn(`  WARNING: Item without 'id' field, skipping:`, JSON.stringify(item).slice(0, 100));
        continue;
      }

      const ref = db.collection(collectionName).doc(docId);
      batch.set(ref, rewritten);
      written++;
    }

    await batch.commit();
    console.log(`  Written ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
  }

  console.log(`  ✓ Migrated ${written} documents to ${collectionName}`);
  return written;
}

/**
 * Migrate photos from S3 to Cloud Storage
 */
async function migratePhotos() {
  const sourceBucket = process.env.SOURCE_PHOTOS_BUCKET;
  const targetBucket = process.env.TARGET_PHOTOS_BUCKET;

  if (!sourceBucket || !targetBucket) {
    console.log('\n--- Skipping photo migration (SOURCE_PHOTOS_BUCKET or TARGET_PHOTOS_BUCKET not set) ---');
    return 0;
  }

  console.log(`\n--- Migrating photos: s3://${sourceBucket} → gs://${targetBucket} ---`);

  let copied = 0;
  let continuationToken = undefined;

  do {
    const listParams = {
      Bucket: sourceBucket,
      MaxKeys: 1000,
    };
    if (continuationToken) {
      listParams.ContinuationToken = continuationToken;
    }

    const listResult = await s3Client.send(new ListObjectsV2Command(listParams));
    const objects = listResult.Contents || [];

    console.log(`  Found ${objects.length} objects in this batch`);

    if (DRY_RUN) {
      copied += objects.length;
      continuationToken = listResult.NextContinuationToken;
      continue;
    }

    for (const obj of objects) {
      try {
        // Download from S3
        const getResult = await s3Client.send(new GetObjectCommand({
          Bucket: sourceBucket,
          Key: obj.Key,
        }));

        const bodyBuffer = await streamToBuffer(getResult.Body);

        // Upload to GCS
        const gcsBucket = storage.bucket(targetBucket);
        const file = gcsBucket.file(obj.Key);

        await file.save(bodyBuffer, {
          contentType: getResult.ContentType || 'application/octet-stream',
          metadata: {
            cacheControl: 'public, max-age=31536000',
          },
        });

        copied++;
        if (copied % 50 === 0) {
          console.log(`  Copied ${copied} photos...`);
        }
      } catch (err) {
        console.error(`  ERROR copying ${obj.Key}:`, err.message);
      }
    }

    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  console.log(`  ✓ Copied ${copied} photos to gs://${targetBucket}`);
  return copied;
}

/**
 * Convert a readable stream to a Buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Verify migration by comparing counts
 */
async function verifyCounts() {
  console.log('\n--- Verification ---');

  for (const [tableName, collectionName] of Object.entries(TABLE_MAP)) {
    const dynamoItems = await scanAllItems(tableName);
    const firestoreSnapshot = await db.collection(collectionName).count().get();
    const firestoreCount = firestoreSnapshot.data().count;

    const match = dynamoItems.length === firestoreCount ? '✓' : '✗ MISMATCH';
    console.log(`  ${match} ${collectionName}: DynamoDB=${dynamoItems.length}, Firestore=${firestoreCount}`);
  }
}

async function main() {
  console.log('=== Expense Splitter: DynamoDB → Firestore Migration ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`GCP Project: ${process.env.GCP_PROJECT_ID}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'us-west-2'}`);

  if (OLD_DOMAIN && NEW_BASE_URL) {
    console.log(`URL rewrite: https://${OLD_DOMAIN} → ${NEW_BASE_URL}`);
  }

  const startTime = Date.now();

  // Migrate data tables
  const totals = {};
  for (const [tableName, collectionName] of Object.entries(TABLE_MAP)) {
    totals[collectionName] = await migrateTable(tableName, collectionName);
  }

  // Migrate photos
  const photoCount = await migratePhotos();

  // Verify if not dry run
  if (!DRY_RUN) {
    await verifyCounts();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Migration Summary ===');
  for (const [collection, count] of Object.entries(totals)) {
    console.log(`  ${collection}: ${count} documents`);
  }
  console.log(`  photos: ${photoCount} files`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
