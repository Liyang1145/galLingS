//! Compile exactly one desktop host entry. The rebuild host never imports the legacy host.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(feature = "rebuild-host"))]
mod legacy;
#[cfg(feature = "rebuild-host")]
mod rebuild;
#[cfg(all(feature = "rebuild-host", target_os = "windows"))]
mod rebuild_storage;

#[cfg(not(feature = "rebuild-host"))]
fn main() {
    legacy::run();
}

#[cfg(feature = "rebuild-host")]
fn main() {
    rebuild::run();
}
