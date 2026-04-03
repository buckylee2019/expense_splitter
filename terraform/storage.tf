# Photos bucket
resource "google_storage_bucket" "photos" {
  name     = "${var.project_id}-expense-splitter-photos"
  location = "US-CENTRAL1"

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.apis]
}

# Public read access for photos
resource "google_storage_bucket_iam_member" "photos_public_read" {
  bucket = google_storage_bucket.photos.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Frontend static site bucket
resource "google_storage_bucket" "frontend" {
  name     = "${var.project_id}-expense-splitter-frontend"
  location = "US-CENTRAL1"

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  depends_on = [google_project_service.apis]
}

# Public read access for frontend
resource "google_storage_bucket_iam_member" "frontend_public_read" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
