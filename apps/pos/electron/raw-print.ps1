$ErrorActionPreference = 'Stop'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class TryoRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DocInfo {
    [MarshalAs(UnmanagedType.LPWStr)] public string Name = "Tryo receipt";
    [MarshalAs(UnmanagedType.LPWStr)] public string Output = null;
    [MarshalAs(UnmanagedType.LPWStr)] public string DataType = "RAW";
  }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo info);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr handle, IntPtr data, int count, out int written);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool AbortPrinter(IntPtr handle);
  [DllImport("winspool.drv")] static extern bool ClosePrinter(IntPtr handle);
  static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  public static void Send(string name, byte[] bytes) {
    IntPtr handle;
    Check(OpenPrinter(name, out handle, IntPtr.Zero));
    bool started = false;
    try {
      Check(StartDocPrinter(handle, 1, new DocInfo()) != 0);
      started = true;
      Check(StartPagePrinter(handle));
      var pinned = GCHandle.Alloc(bytes, GCHandleType.Pinned);
      try {
        int offset = 0;
        while (offset < bytes.Length) {
          int written;
          Check(WritePrinter(handle, IntPtr.Add(pinned.AddrOfPinnedObject(), offset), bytes.Length - offset, out written));
          if (written <= 0) throw new Exception("The printer accepted no data.");
          offset += written;
        }
      } finally { pinned.Free(); }
      Check(EndPagePrinter(handle));
      Check(EndDocPrinter(handle));
      started = false;
    } finally {
      if (started) AbortPrinter(handle);
      ClosePrinter(handle);
    }
  }
}
'@
  [TryoRawPrinter]::Send($request.printer, [Convert]::FromBase64String($request.data))
  [Console]::Out.Write('OK')
} catch {
  [Console]::Error.Write($_.Exception.GetBaseException().Message)
  exit 1
}
