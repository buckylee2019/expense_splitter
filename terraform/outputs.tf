output "api_url" {
  description = "Cloud Run API URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "frontend_url" {
  description = "Frontend static site URL"
  value       = "https://storage.googleapis.com/${google_storage_bucket.frontend.name}/index.html"
}

output "photos_base_url" {
  description = "Photos public URL prefix"
  value       = "https://storage.googleapis.com/${google_storage_bucket.photos.name}"
}

output "photos_bucket_name" {
  description = "Photos bucket name"
  value       = google_storage_bucket.photos.name
}

output "frontend_bucket_name" {
  description = "Frontend bucket name"
  value       = google_storage_bucket.frontend.name
}

output "artifact_registry" {
  description = "Docker image registry path"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}"
}
