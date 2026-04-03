# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = "expense-splitter"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# JWT Secret in Secret Manager
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "expense-splitter-jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

# Cloud Run service
resource "google_cloud_run_v2_service" "api" {
  name     = "expense-splitter"
  location = var.region

  template {
    service_account = google_service_account.cloud_run.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/api:latest"

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "PHOTOS_BUCKET_NAME"
        value = google_storage_bucket.photos.name
      }

      env {
        name  = "PHOTOS_BASE_URL"
        value = "https://storage.googleapis.com/${google_storage_bucket.photos.name}"
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.jwt_secret,
  ]
}

# Allow unauthenticated access to Cloud Run
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
