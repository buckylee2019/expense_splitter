# Service account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "expense-splitter-api"
  display_name = "Expense Splitter Cloud Run SA"

  depends_on = [google_project_service.apis]
}

# Firestore read/write
resource "google_project_iam_member" "cloud_run_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Storage upload/delete for photos
resource "google_storage_bucket_iam_member" "cloud_run_photos" {
  bucket = google_storage_bucket.photos.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager access
resource "google_project_iam_member" "cloud_run_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}
