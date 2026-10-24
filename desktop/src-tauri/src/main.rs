//! Windows host for the shared TypeScript game.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod rebuild;
#[cfg(target_os = "windows")]
mod rebuild_storage;

fn main() {
    rebuild::run();
}
