import { spawn } from 'child_process'

// A low-level keyboard hook (WH_KEYBOARD_LL) sees every key before Windows
// acts on it. While WinDiag is the foreground window it reports each key and
// swallows it, so the Windows key doesn't open Start, Print Screen doesn't
// take a screenshot, Esc/Alt+Tab/Alt+F4 do nothing and Caps/Num/Scroll Lock
// don't toggle (their LEDs stay as they were). Ctrl+Alt+Del can't be hooked,
// so it always works as a way out. A key-up is only swallowed if its key-down
// was, so a modifier held while switching windows never gets stuck.
const KEYBOARD_HOOK_SOURCE = String.raw`
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

namespace WinDiag {
public static class KeyboardHook {
    delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int ptX, ptY; }

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc fn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    static extern int GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr GetModuleHandle(string name);

    const int WH_KEYBOARD_LL = 13, WM_KEYUP = 0x101, WM_SYSKEYUP = 0x105;
    const uint LLKHF_EXTENDED = 0x01, LLKHF_INJECTED = 0x10;

    // Kept in a static field so the GC never collects the callback
    static readonly LowLevelKeyboardProc callback = OnKey;
    static readonly bool[] swallowed = new bool[256];
    static IntPtr hook;
    static uint ownerPid;

    public static void Run(int pid) {
        ownerPid = (uint)pid;
        // Exit with WinDiag even if it's killed without stopping the hook
        Process owner = Process.GetProcessById(pid);
        Thread watcher = new Thread(() => { owner.WaitForExit(); Environment.Exit(0); });
        watcher.IsBackground = true;
        watcher.Start();

        hook = SetWindowsHookEx(WH_KEYBOARD_LL, callback, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) { Console.Out.WriteLine("FAIL"); return; }
        Console.Out.WriteLine("READY");
        // Low-level hooks are called through this thread's message loop
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { }
    }

    static IntPtr OnKey(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            KBDLLHOOKSTRUCT info = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            int message = wParam.ToInt32();
            bool up = message == WM_KEYUP || message == WM_SYSKEYUP;
            uint vk = info.vkCode & 0xFF;
            bool take = (info.flags & LLKHF_INJECTED) == 0 && (up ? swallowed[vk] : OwnerIsForeground());
            if (take) {
                swallowed[vk] = !up;
                Console.Out.WriteLine((up ? "U " : "D ") + vk + " " + info.scanCode + " " + (info.flags & LLKHF_EXTENDED));
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(hook, nCode, wParam, lParam);
    }

    static bool OwnerIsForeground() {
        uint pid;
        GetWindowThreadProcessId(GetForegroundWindow(), out pid);
        return pid == ownerPid;
    }
}
}
`

// Scan codes (set 1) name the physical key, like KeyboardEvent.code, so the
// mapping doesn't depend on the keyboard layout.
const SCAN_CODES = {
  0x01: 'Escape',
  0x02: 'Digit1',
  0x03: 'Digit2',
  0x04: 'Digit3',
  0x05: 'Digit4',
  0x06: 'Digit5',
  0x07: 'Digit6',
  0x08: 'Digit7',
  0x09: 'Digit8',
  0x0a: 'Digit9',
  0x0b: 'Digit0',
  0x0c: 'Minus',
  0x0d: 'Equal',
  0x0e: 'Backspace',
  0x0f: 'Tab',
  0x10: 'KeyQ',
  0x11: 'KeyW',
  0x12: 'KeyE',
  0x13: 'KeyR',
  0x14: 'KeyT',
  0x15: 'KeyY',
  0x16: 'KeyU',
  0x17: 'KeyI',
  0x18: 'KeyO',
  0x19: 'KeyP',
  0x1a: 'BracketLeft',
  0x1b: 'BracketRight',
  0x1c: 'Enter',
  0x1d: 'ControlLeft',
  0x1e: 'KeyA',
  0x1f: 'KeyS',
  0x20: 'KeyD',
  0x21: 'KeyF',
  0x22: 'KeyG',
  0x23: 'KeyH',
  0x24: 'KeyJ',
  0x25: 'KeyK',
  0x26: 'KeyL',
  0x27: 'Semicolon',
  0x28: 'Quote',
  0x29: 'Backquote',
  0x2a: 'ShiftLeft',
  0x2b: 'Backslash',
  0x2c: 'KeyZ',
  0x2d: 'KeyX',
  0x2e: 'KeyC',
  0x2f: 'KeyV',
  0x30: 'KeyB',
  0x31: 'KeyN',
  0x32: 'KeyM',
  0x33: 'Comma',
  0x34: 'Period',
  0x35: 'Slash',
  0x36: 'ShiftRight',
  0x37: 'NumpadMultiply',
  0x38: 'AltLeft',
  0x39: 'Space',
  0x3a: 'CapsLock',
  0x3b: 'F1',
  0x3c: 'F2',
  0x3d: 'F3',
  0x3e: 'F4',
  0x3f: 'F5',
  0x40: 'F6',
  0x41: 'F7',
  0x42: 'F8',
  0x43: 'F9',
  0x44: 'F10',
  0x46: 'ScrollLock',
  0x47: 'Numpad7',
  0x48: 'Numpad8',
  0x49: 'Numpad9',
  0x4a: 'NumpadSubtract',
  0x4b: 'Numpad4',
  0x4c: 'Numpad5',
  0x4d: 'Numpad6',
  0x4e: 'NumpadAdd',
  0x4f: 'Numpad1',
  0x50: 'Numpad2',
  0x51: 'Numpad3',
  0x52: 'Numpad0',
  0x53: 'NumpadDecimal',
  0x56: 'IntlBackslash',
  0x57: 'F11',
  0x58: 'F12'
}

// Keys whose scan code carries the E0 (extended) prefix
const EXTENDED_SCAN_CODES = {
  0x1c: 'NumpadEnter',
  0x1d: 'ControlRight',
  0x35: 'NumpadDivide',
  // Low-level hooks flag Right Shift as extended, unlike its real scan code
  0x36: 'ShiftRight',
  0x37: 'PrintScreen',
  0x38: 'AltRight',
  // Ctrl+Pause (Break)
  0x46: 'Pause',
  0x47: 'Home',
  0x48: 'ArrowUp',
  0x49: 'PageUp',
  0x4b: 'ArrowLeft',
  0x4d: 'ArrowRight',
  0x4f: 'End',
  0x50: 'ArrowDown',
  0x51: 'PageDown',
  0x52: 'Insert',
  0x53: 'Delete',
  0x5b: 'MetaLeft',
  0x5c: 'MetaRight',
  0x5d: 'ContextMenu'
}

// Pause and Num Lock share scan code 0x45, and Alt+Print Screen sends 0x54,
// so these are told apart by virtual-key code instead.
const VIRTUAL_KEY_CODES = {
  0x13: 'Pause',
  0x2c: 'PrintScreen',
  0x90: 'NumLock'
}

function keyCodeFor(vk, scanCode, extended) {
  return (
    VIRTUAL_KEY_CODES[vk] ??
    (extended ? EXTENDED_SCAN_CODES[scanCode] : SCAN_CODES[scanCode]) ??
    null
  )
}

// Compiling the hook with Add-Type takes a few seconds on a slow machine
const START_TIMEOUT_MS = 20e3

let hookProcess = null

/**
 * Starts the hook in its own PowerShell process (it blocks in a message
 * loop, so it can't share the query session) and calls onKey with
 * { code, type: 'keyDown' | 'keyUp', isAutoRepeat } for each key. Resolves
 * with whether the hook is running.
 */
export function startKeyboardHook(onKey) {
  stopKeyboardHook()
  if (process.platform !== 'win32') return Promise.resolve(false)
  const script = `try {
Add-Type -TypeDefinition @'
${KEYBOARD_HOOK_SOURCE}
'@
[WinDiag.KeyboardHook]::Run(${process.pid})
} catch { [Console]::Out.WriteLine('FAIL') }`
  return new Promise((resolve) => {
    const proc = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NoLogo',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64')
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    hookProcess = proc
    const held = new Set()
    let buffer = ''
    let settled = false
    const settle = (running) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!running && hookProcess === proc) stopKeyboardHook()
      resolve(running)
    }
    const timer = setTimeout(() => settle(false), START_TIMEOUT_MS)
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) {
        if (line === 'READY') {
          settle(true)
          continue
        }
        if (line === 'FAIL') {
          settle(false)
          continue
        }
        const match = /^([DU]) (\d+) (\d+) ([01])$/.exec(line)
        if (!match) continue
        const code = keyCodeFor(Number(match[2]), Number(match[3]), match[4] === '1')
        if (!code) continue
        if (match[1] === 'D') {
          const isAutoRepeat = held.has(code)
          held.add(code)
          onKey({ code, type: 'keyDown', isAutoRepeat })
        } else {
          held.delete(code)
          onKey({ code, type: 'keyUp', isAutoRepeat: false })
        }
      }
    })
    const onExit = () => {
      if (hookProcess === proc) hookProcess = null
      settle(false)
    }
    proc.on('exit', onExit)
    proc.on('error', onExit)
  })
}

export function stopKeyboardHook() {
  const proc = hookProcess
  hookProcess = null
  proc?.kill()
}
