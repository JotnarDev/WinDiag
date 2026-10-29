import { parseJsonArray, runPowerShell } from './powershell'

const cleanString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Reads every USB hub port straight from the hub driver, the same way
// Microsoft's USBView does. The firmware (ACPI _UPC) says which ports a user
// can plug into and which are USB-C, and links each USB 3 port to its USB 2
// "companion" — both halves of the same physical connector.
const USB_PORT_SCAN_SOURCE = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace WinDiag {
public class UsbPortInfo {
    public string Hub { get; set; }
    public string HubDriverKey { get; set; }
    public bool IsRootHub { get; set; }
    public int Port { get; set; }
    public bool Connectable { get; set; }
    public bool TypeC { get; set; }
    public string CompanionHub { get; set; }
    public int CompanionPort { get; set; }
    public bool Connected { get; set; }
    public int Speed { get; set; }
    public bool IsHub { get; set; }
    public string DeviceDriverKey { get; set; }
    public string DeviceName { get; set; }
}

public static class UsbPorts {
    const int DIGCF_PRESENT = 0x2, DIGCF_ALLCLASSES = 0x4, DIGCF_DEVICEINTERFACE = 0x10;
    const int SPDRP_DEVICEDESC = 0, SPDRP_DRIVER = 9, SPDRP_FRIENDLYNAME = 12;
    // CTL_CODE(FILE_DEVICE_USB, function, METHOD_BUFFERED, FILE_ANY_ACCESS)
    const uint IOCTL_USB_GET_NODE_INFORMATION = 0x220408;
    const uint IOCTL_USB_GET_NODE_CONNECTION_DRIVERKEY_NAME = 0x220420;
    const uint IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX = 0x220448;
    const uint IOCTL_USB_GET_PORT_CONNECTOR_PROPERTIES = 0x220458;
    static readonly IntPtr INVALID = new IntPtr(-1);
    static readonly Guid HubInterface = new Guid("f18a0e88-c30c-11d0-8815-00a0c906bed8");
    static readonly Guid BusReportedDescFmt = new Guid("540b947e-8b40-45bc-a8a2-6a0b894cbda2");

    [StructLayout(LayoutKind.Sequential)]
    struct SP_DEVINFO_DATA { public int cbSize; public Guid ClassGuid; public int DevInst; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)]
    struct SP_DEVICE_INTERFACE_DATA { public int cbSize; public Guid InterfaceClassGuid; public int Flags; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)]
    struct DEVPROPKEY { public Guid fmtid; public int pid; }

    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr SetupDiGetClassDevs(ref Guid classGuid, string enumerator, IntPtr hwnd, int flags);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "SetupDiGetClassDevsW")]
    static extern IntPtr SetupDiGetClassDevsAll(IntPtr classGuid, string enumerator, IntPtr hwnd, int flags);
    [DllImport("setupapi.dll", SetLastError = true)]
    static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr devInfo, ref Guid guid, int index, ref SP_DEVICE_INTERFACE_DATA data);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref SP_DEVICE_INTERFACE_DATA data, IntPtr detail, int size, out int required, ref SP_DEVINFO_DATA devInfo);
    [DllImport("setupapi.dll", SetLastError = true)]
    static extern bool SetupDiEnumDeviceInfo(IntPtr set, int index, ref SP_DEVINFO_DATA devInfo);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SetupDiGetDeviceInstanceId(IntPtr set, ref SP_DEVINFO_DATA devInfo, StringBuilder id, int size, out int required);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SetupDiGetDeviceRegistryProperty(IntPtr set, ref SP_DEVINFO_DATA devInfo, int property, out int regType, byte[] buffer, int size, out int required);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "SetupDiGetDevicePropertyW")]
    static extern bool SetupDiGetDeviceProperty(IntPtr set, ref SP_DEVINFO_DATA devInfo, ref DEVPROPKEY key, out int propType, byte[] buffer, int size, out int required, int flags);
    [DllImport("setupapi.dll")]
    static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(SafeFileHandle handle, uint code, byte[] inBuffer, int inSize, byte[] outBuffer, int outSize, out int returned, IntPtr overlapped);

    static string Normalize(string path) {
        return path.TrimStart('\\', '?', '.').ToLowerInvariant();
    }

    static string Utf16(byte[] buffer, int offset, int length) {
        length = Math.Min(length, buffer.Length - offset);
        if (length <= 0) return null;
        string value = Encoding.Unicode.GetString(buffer, offset, length).TrimEnd('\0');
        return value.Length > 0 ? value : null;
    }

    static string RegString(IntPtr set, ref SP_DEVINFO_DATA dev, int property) {
        byte[] buffer = new byte[1024];
        int type, required;
        if (!SetupDiGetDeviceRegistryProperty(set, ref dev, property, out type, buffer, buffer.Length, out required)) return null;
        return Utf16(buffer, 0, required);
    }

    static string BusReportedName(IntPtr set, ref SP_DEVINFO_DATA dev) {
        DEVPROPKEY key = new DEVPROPKEY();
        key.fmtid = BusReportedDescFmt;
        key.pid = 4;
        byte[] buffer = new byte[1024];
        int type, required;
        if (!SetupDiGetDeviceProperty(set, ref dev, ref key, out type, buffer, buffer.Length, out required, 0)) return null;
        return Utf16(buffer, 0, required);
    }

    static byte[] Query(SafeFileHandle hub, uint code, int port, int size) {
        byte[] buffer = new byte[size];
        BitConverter.GetBytes(port).CopyTo(buffer, 0);
        int returned;
        return DeviceIoControl(hub, code, buffer, size, buffer, size, out returned, IntPtr.Zero) ? buffer : null;
    }

    static SafeFileHandle OpenHub(string path) {
        // GENERIC_WRITE as USBView does, then query-only access as a fallback
        foreach (uint access in new uint[] { 0x40000000, 0 }) {
            SafeFileHandle handle = CreateFile(path, access, 0x3, IntPtr.Zero, 3, 0, IntPtr.Zero);
            if (!handle.IsInvalid) return handle;
            handle.Dispose();
        }
        return null;
    }

    static void ScanHub(string path, bool isRoot, string hubKey, List<UsbPortInfo> result) {
        using (SafeFileHandle hub = OpenHub(path)) {
            if (hub == null) return;
            byte[] node = Query(hub, IOCTL_USB_GET_NODE_INFORMATION, 0, 256);
            if (node == null) return;
            int count = node[6]; // HubDescriptor.bNumberOfPorts
            for (int port = 1; port <= count; port++) {
                UsbPortInfo info = new UsbPortInfo();
                info.Hub = Normalize(path);
                info.HubDriverKey = hubKey;
                info.IsRootHub = isRoot;
                info.Port = port;
                byte[] props = Query(hub, IOCTL_USB_GET_PORT_CONNECTOR_PROPERTIES, port, 1024);
                if (props != null) {
                    uint flags = BitConverter.ToUInt32(props, 8);
                    info.Connectable = (flags & 1) != 0;
                    info.TypeC = (flags & 8) != 0;
                    info.CompanionPort = BitConverter.ToUInt16(props, 14);
                    string companion = Utf16(props, 16, BitConverter.ToInt32(props, 4) - 16);
                    if (info.CompanionPort > 0 && companion != null) info.CompanionHub = Normalize(companion);
                } else {
                    // No firmware information (old systems): assume it's reachable
                    info.Connectable = true;
                }
                byte[] connection = Query(hub, IOCTL_USB_GET_NODE_CONNECTION_INFORMATION_EX, port, 512);
                if (connection != null) {
                    info.Speed = connection[23];
                    info.IsHub = connection[24] != 0;
                    info.Connected = BitConverter.ToInt32(connection, 31) == 1; // DeviceConnected
                }
                if (info.Connected) {
                    byte[] key = Query(hub, IOCTL_USB_GET_NODE_CONNECTION_DRIVERKEY_NAME, port, 512);
                    if (key != null) info.DeviceDriverKey = Utf16(key, 8, BitConverter.ToInt32(key, 4) - 8);
                }
                result.Add(info);
            }
        }
    }

    static void ResolveNames(List<UsbPortInfo> ports) {
        HashSet<string> keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (UsbPortInfo port in ports) if (port.DeviceDriverKey != null) keys.Add(port.DeviceDriverKey);
        if (keys.Count == 0) return;
        Dictionary<string, string> names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        IntPtr set = SetupDiGetClassDevsAll(IntPtr.Zero, "USB", IntPtr.Zero, DIGCF_PRESENT | DIGCF_ALLCLASSES);
        if (set == INVALID) return;
        try {
            for (int i = 0; ; i++) {
                SP_DEVINFO_DATA dev = new SP_DEVINFO_DATA();
                dev.cbSize = Marshal.SizeOf(dev);
                if (!SetupDiEnumDeviceInfo(set, i, ref dev)) break;
                string key = RegString(set, ref dev, SPDRP_DRIVER);
                if (key == null || !keys.Contains(key)) continue;
                // The product name the device reports beats the generic
                // driver description ("USB Mass Storage Device")
                names[key] = BusReportedName(set, ref dev) ?? RegString(set, ref dev, SPDRP_FRIENDLYNAME) ?? RegString(set, ref dev, SPDRP_DEVICEDESC);
            }
        } finally {
            SetupDiDestroyDeviceInfoList(set);
        }
        foreach (UsbPortInfo port in ports) {
            string name;
            if (port.DeviceDriverKey != null && names.TryGetValue(port.DeviceDriverKey, out name)) port.DeviceName = name;
        }
    }

    public static List<UsbPortInfo> Scan() {
        List<UsbPortInfo> result = new List<UsbPortInfo>();
        Guid hubGuid = HubInterface;
        IntPtr set = SetupDiGetClassDevs(ref hubGuid, null, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
        if (set == INVALID) return result;
        try {
            for (int i = 0; ; i++) {
                SP_DEVICE_INTERFACE_DATA iface = new SP_DEVICE_INTERFACE_DATA();
                iface.cbSize = Marshal.SizeOf(iface);
                if (!SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref hubGuid, i, ref iface)) break;
                SP_DEVINFO_DATA dev = new SP_DEVINFO_DATA();
                dev.cbSize = Marshal.SizeOf(dev);
                int required;
                SetupDiGetDeviceInterfaceDetail(set, ref iface, IntPtr.Zero, 0, out required, ref dev);
                if (required <= 0) continue;
                string path = null;
                IntPtr detail = Marshal.AllocHGlobal(required);
                try {
                    // SP_DEVICE_INTERFACE_DETAIL_DATA_W.cbSize
                    Marshal.WriteInt32(detail, IntPtr.Size == 8 ? 8 : 6);
                    if (SetupDiGetDeviceInterfaceDetail(set, ref iface, detail, required, out required, ref dev)) {
                        path = Marshal.PtrToStringUni(new IntPtr(detail.ToInt64() + 4));
                    }
                } finally {
                    Marshal.FreeHGlobal(detail);
                }
                if (path == null) continue;
                StringBuilder id = new StringBuilder(512);
                int idLength;
                bool isRoot = SetupDiGetDeviceInstanceId(set, ref dev, id, id.Capacity, out idLength) &&
                    id.ToString().StartsWith("USB\\ROOT_HUB", StringComparison.OrdinalIgnoreCase);
                ScanHub(path, isRoot, RegString(set, ref dev, SPDRP_DRIVER), result);
            }
        } finally {
            SetupDiDestroyDeviceInfoList(set);
        }
        ResolveNames(result);
        return result;
    }
}
}
`

// The type is compiled once per PowerShell session (~1 s the first time)
const USB_PORT_SCAN_SCRIPT = `
if (-not ('WinDiag.UsbPorts' -as [type])) {
    Add-Type -TypeDefinition @'
${USB_PORT_SCAN_SOURCE}
'@
}
[WinDiag.UsbPorts]::Scan() | ConvertTo-Json -Compress
`.trim()

/**
 * The machine's physical USB ports and what's plugged into each. Built-in
 * hubs (root hubs, and hubs wired to a non-user port, like the internal
 * "rate matching" hub of older Intel chipsets) are walked; a hub plugged into
 * an external port is just the device on that port.
 */
export async function getUsbPorts() {
  let rows
  try {
    rows = parseJsonArray(await runPowerShell(USB_PORT_SCAN_SCRIPT, 20e3))
  } catch {
    return { supported: false, ports: [] }
  }
  const internalHubs = new Set(rows.filter((r) => r.IsRootHub).map((r) => r.HubDriverKey))
  for (let grew = true; grew;) {
    grew = false
    for (const r of rows) {
      const key = r.DeviceDriverKey
      if (r.IsHub && !r.Connectable && internalHubs.has(r.HubDriverKey) && !internalHubs.has(key)) {
        internalHubs.add(key)
        grew = true
      }
    }
  }
  const keyOf = (hub, port) => `${hub}|${port}`
  const userPorts = rows.filter((r) => r.Connectable && internalHubs.has(r.HubDriverKey))
  const byKey = new Map(userPorts.map((r) => [keyOf(r.Hub, r.Port), r]))

  // A USB 3 connector shows up twice (its USB 2 and USB 3 halves): merge
  // companions into one physical port.
  const parent = new Map([...byKey.keys()].map((k) => [k, k]))
  const find = (k) => (parent.get(k) === k ? k : find(parent.get(k)))
  for (const [key, r] of byKey) {
    const companion = r.CompanionPort > 0 && keyOf(r.CompanionHub, r.CompanionPort)
    if (companion && byKey.has(companion)) parent.set(find(key), find(companion))
  }
  const groups = new Map()
  for (const [key, r] of byKey) {
    const root = find(key)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(r)
  }

  const ports = [...groups.entries()].map(([id, members]) => {
    const plugged = members.find((m) => m.Connected)
    return {
      id,
      typeC: members.some((m) => m.TypeC),
      connected: Boolean(plugged),
      deviceName: plugged ? (cleanString(plugged.DeviceName) ?? 'USB device') : null,
      // USB_DEVICE_SPEED: 0 low, 1 full, 2 high (USB 2), 3 super (USB 3)
      superSpeed: Boolean(plugged && plugged.Speed >= 3)
    }
  })
  return { supported: true, ports }
}
