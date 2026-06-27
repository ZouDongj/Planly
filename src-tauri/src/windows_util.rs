// Windows-specific utilities for proper toast notification integration.
// Uses raw COM FFI — no external crate dependencies beyond what Tauri provides.

#[cfg(target_os = "windows")]
use std::ffi::c_void;

// ─── AUMID ────────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
extern "system" {
    fn SetCurrentProcessExplicitAppUserModelID(pcid: *const u16) -> i32;
}

#[cfg(target_os = "windows")]
pub fn setup_app_user_model() {
    let aumid: Vec<u16> = "com.z7614.planly"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe { SetCurrentProcessExplicitAppUserModelID(aumid.as_ptr()); }
}

// ─── COM primitives ───────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
type HRESULT = i32;
#[cfg(target_os = "windows")]
const S_OK: HRESULT = 0;

#[cfg(target_os = "windows")]
#[repr(C)]
struct GUID { data1: u32, data2: u16, data3: u16, data4: [u8; 8] }

#[cfg(target_os = "windows")]
const CLSID_SHELL_LINK: GUID = GUID {
    data1: 0x00021401, data2: 0x0000, data3: 0x0000,
    data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
};
#[cfg(target_os = "windows")]
const IID_ISHELL_LINK_W: GUID = GUID {
    data1: 0x000214F9, data2: 0x0000, data3: 0x0000,
    data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
};
#[cfg(target_os = "windows")]
const IID_IPROPERTY_STORE: GUID = GUID {
    data1: 0x886d8eeb, data2: 0x8cf2, data3: 0x4446,
    data4: [0x8d, 0x02, 0xcd, 0xba, 0x1d, 0xbd, 0xcf, 0x99],
};
#[cfg(target_os = "windows")]
const CLSCTX_INPROC_SERVER: u32 = 1;

#[cfg(target_os = "windows")]
extern "system" {
    fn CoCreateInstance(
        rclsid: *const GUID,
        pUnkOuter: *const c_void,
        dwClsContext: u32,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> HRESULT;
}

// ─── IUnknown ─────────────────────────────────────────────────────────────────
// Every COM interface starts with these 3 methods

#[cfg(target_os = "windows")]
#[repr(C)]
struct IUnknownVtbl {
    query_interface: unsafe extern "system" fn(
        this: *mut c_void,
        riid: *const GUID,
        ppv: *mut *mut c_void,
    ) -> HRESULT,
    add_ref: unsafe extern "system" fn(this: *mut c_void) -> u32,
    release: unsafe extern "system" fn(this: *mut c_void) -> u32,
}

// ─── IShellLinkW vtable ──────────────────────────────────────────────────────
// IShellLinkW : IPersistFile : IPersist : IUnknown
// Vtable indices after IUnknown (0-2):
//   3=GetClassID 4=IsDirty 5=Load 6=Save 7=SaveCompleted 8=GetCurFile
//   9=GetPathW 10=GetIDList 11=SetIDList 12=GetDescription 13=SetDescription
//   14=GetWorkingDirectory 15=SetWorkingDirectory 16=GetArguments 17=SetArguments
//   18=GetHotkey 19=SetHotkey 20=GetShowCmd 21=SetShowCmd
//   22=GetIconLocation 23=SetIconLocation 24=SetRelativePath 25=Resolve 26=SetPathW

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct IShellLinkWVtbl {
    iunknown: IUnknownVtbl,
    get_class_id: usize,
    is_dirty: usize,
    load: usize,
    save: unsafe extern "system" fn(
        this: *mut c_void,
        pszFile: *const u16,
        fRemember: u32,
    ) -> HRESULT,
    save_completed: usize,
    get_cur_file: usize,
    get_path: usize,
    get_id_list: usize,
    set_id_list: usize,
    get_description: usize,
    set_description: usize,
    get_working_directory: usize,
    set_working_directory: unsafe extern "system" fn(
        this: *mut c_void,
        pszDir: *const u16,
    ) -> HRESULT,
    get_arguments: usize,
    set_arguments: usize,
    get_hotkey: usize,
    set_hotkey: usize,
    get_show_cmd: usize,
    set_show_cmd: usize,
    get_icon_location: usize,
    set_icon_location: usize,
    set_relative_path: usize,
    resolve: usize,
    set_path: unsafe extern "system" fn(
        this: *mut c_void,
        pszFile: *const u16,
    ) -> HRESULT,
}

// ─── IPropertyStore vtable ────────────────────────────────────────────────────
// IPropertyStore : IUnknown
//   3=GetCount 4=GetAt 5=GetValue 6=SetValue 7=Commit

#[cfg(target_os = "windows")]
#[repr(C)]
struct PROPERTYKEY {
    fmtid: GUID,
    pid: u32,
}

#[cfg(target_os = "windows")]
const PKEY_APPUSERMODEL_ID: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID { data1: 0x9F4C2855, data2: 0x9F79, data3: 0x4B39,
        data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3] },
    pid: 26,
};

#[cfg(target_os = "windows")]
const VT_LPWSTR: u16 = 31;

#[cfg(target_os = "windows")]
#[repr(C)]
struct IPropertyStoreVtbl {
    iunknown: IUnknownVtbl,
    get_count: usize,
    get_at: usize,
    get_value: usize,
    set_value: unsafe extern "system" fn(
        this: *mut c_void,
        key: *const PROPERTYKEY,
        propvar: *const PROPVARIANT,
    ) -> HRESULT,
    commit: unsafe extern "system" fn(this: *mut c_void) -> HRESULT,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct PROPVARIANT {
    vt: u16,
    _reserved1: u16,
    _reserved2: u16,
    _reserved3: u16,
    data: *mut u16, // pwszVal for VT_LPWSTR
}

// ─── Public entry point ───────────────────────────────────────────────────────

/// Create a Start Menu shortcut with AppUserModelID set.
/// Windows requires this for toast notifications to show the app icon & name.
#[cfg(target_os = "windows")]
pub fn ensure_start_menu_shortcut(_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let exe_path = std::env::current_exe()?;
    let exe_path_str = exe_path.to_string_lossy();
    let exe_wide: Vec<u16> = exe_path_str.encode_utf16().chain(std::iter::once(0)).collect();

    let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new(""));
    let exe_dir_str = exe_dir.to_string_lossy();
    let dir_wide: Vec<u16> = exe_dir_str.encode_utf16().chain(std::iter::once(0)).collect();

    // Start Menu Programs folder
    let programs_dir = match std::env::var("APPDATA") {
        Ok(appdata) => std::path::PathBuf::from(appdata)
            .join("Microsoft").join("Windows").join("Start Menu").join("Programs"),
        Err(_) => return Ok(()),
    };

    let shortcut_path = programs_dir.join("Planly.lnk");
    // Always recreate to ensure AUMID is set correctly
    if shortcut_path.exists() {
        let _ = std::fs::remove_file(&shortcut_path);
    }

    std::fs::create_dir_all(&programs_dir)?;

    let shortcut_wide: Vec<u16> = shortcut_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        // CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC, IID_IShellLinkW, &sl)
        let mut sl_ptr: *mut c_void = std::ptr::null_mut();
        let hr = CoCreateInstance(
            &CLSID_SHELL_LINK as *const _,
            std::ptr::null(),
            CLSCTX_INPROC_SERVER,
            &IID_ISHELL_LINK_W as *const _,
            &mut sl_ptr as *mut _,
        );
        if hr != S_OK || sl_ptr.is_null() {
            return Err("CoCreateInstance(ShellLink) failed".into());
        }
        let sl_vtbl = *(sl_ptr as *const *const IShellLinkWVtbl);

        // SetPath
        ((*sl_vtbl).set_path)(sl_ptr, exe_wide.as_ptr());

        // SetWorkingDirectory
        ((*sl_vtbl).set_working_directory)(sl_ptr, dir_wide.as_ptr());

        // QueryInterface(IID_IPropertyStore) → set AppUserModelID
        let mut ps_ptr: *mut c_void = std::ptr::null_mut();
        let hr2 = ((*sl_vtbl).iunknown.query_interface)(
            sl_ptr,
            &IID_IPROPERTY_STORE as *const _,
            &mut ps_ptr as *mut _,
        );
        if hr2 == S_OK && !ps_ptr.is_null() {
            let ps_vtbl = *(ps_ptr as *const *const IPropertyStoreVtbl);

            let aumid_str: Vec<u16> = "com.z7614.planly"
                .encode_utf16().chain(std::iter::once(0)).collect();
            let pv = PROPVARIANT {
                vt: VT_LPWSTR,
                _reserved1: 0, _reserved2: 0, _reserved3: 0,
                data: aumid_str.as_ptr() as *mut u16,
            };

            ((*ps_vtbl).set_value)(ps_ptr, &PKEY_APPUSERMODEL_ID, &pv);
            ((*ps_vtbl).commit)(ps_ptr);
            ((*ps_vtbl).iunknown.release)(ps_ptr);
        }

        // Save shortcut to disk via IPersistFile::Save
        ((*sl_vtbl).save)(sl_ptr, shortcut_wide.as_ptr(), 1);

        // Release
        ((*sl_vtbl).iunknown.release)(sl_ptr);
    }

    Ok(())
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
pub fn setup_app_user_model() {}

#[cfg(not(target_os = "windows"))]
pub fn ensure_start_menu_shortcut(_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
