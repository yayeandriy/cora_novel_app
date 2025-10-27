use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub desc: Option<String>,
    pub path: Option<String>,
    pub timeline_start: Option<String>,
    pub timeline_end: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCreate {
    pub name: String,
    pub desc: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Doc {
    pub id: i64,
    pub project_id: i64,
    pub path: String,
    pub name: Option<String>,
    pub timeline_id: Option<i64>,
    pub text: Option<String>,
}

// Add more models (Character, Event, Draft, Note) as needed
