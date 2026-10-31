//! Windows/Linux host for the shared TypeScript game.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod rebuild;
#[cfg(any(target_os = "windows", target_os = "linux"))]
mod rebuild_storage;

fn main() {
    rebuild::run();
}
