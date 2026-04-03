resource "google_firestore_database" "main" {
  name        = "(default)"
  location_id = "asia-east1"
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# Index for querying expenses by group
resource "google_firestore_index" "expenses_group" {
  collection = "expenses"
  database   = google_firestore_database.main.name

  fields {
    field_path = "group"
    order      = "ASCENDING"
  }

  fields {
    field_path = "createdAt"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.main]
}

# Index for querying settlements by group
resource "google_firestore_index" "settlements_group" {
  collection = "settlements"
  database   = google_firestore_database.main.name

  fields {
    field_path = "group"
    order      = "ASCENDING"
  }

  fields {
    field_path = "createdAt"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.main]
}
