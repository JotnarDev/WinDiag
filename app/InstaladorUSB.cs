// ====================================================================================
// Launcher para Instalar-USB.ps1
// ====================================================================================
// Punto de entrada nativo (.exe) para el instalador de memorias USB. Igual que
// Launcher.cs, su unico trabajo es localizar Instalar-USB.ps1 junto a si mismo y
// ejecutarlo con PowerShell en modo STA (requerido por los cuadros de dialogo
// WinForms del instalador).
//
// A diferencia de Diagnostico-Hardware.exe, este launcher NO requiere permisos de
// Administrador -- copiar archivos a una memoria USB no los necesita -- por lo que
// no lleva manifiesto de elevacion (build.bat lo compila sin /win32manifest).
//
// Compilacion: incluido en build.bat junto con Diagnostico-Hardware.exe.
// ====================================================================================

using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class InstaladorUSB
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string carpetaBase = AppDomain.CurrentDomain.BaseDirectory;
            string rutaScript = Path.Combine(carpetaBase, "Instalar-USB.ps1");

            if (!File.Exists(rutaScript))
            {
                MessageBox.Show(
                    "No se encontro el archivo 'Instalar-USB.ps1' junto al ejecutable." +
                    Environment.NewLine + Environment.NewLine +
                    "Ruta esperada:" + Environment.NewLine + rutaScript,
                    "USB Installer - Hardware Diagnostics",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            string powershellExe = ResolverEjecutablePowerShell();

            var infoProceso = new ProcessStartInfo
            {
                FileName = powershellExe,
                Arguments = "-NoProfile -STA -ExecutionPolicy Bypass -File \"" + rutaScript + "\"",
                UseShellExecute = false,
                WorkingDirectory = carpetaBase
            };

            using (Process proceso = Process.Start(infoProceso))
            {
                // The installer script handles its own dialogs and closes itself when done;
                // the launcher does not need to wait for it.
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "No se pudo iniciar el instalador USB:" +
                Environment.NewLine + Environment.NewLine + ex.Message,
                "USB Installer - Hardware Diagnostics",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private static string ResolverEjecutablePowerShell()
    {
        // Prefiere PowerShell 7+ (pwsh.exe) si esta instalado; si no, usa Windows PowerShell.
        try
        {
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string rutaPwsh = Path.Combine(programFiles, "PowerShell", "7", "pwsh.exe");
            if (File.Exists(rutaPwsh))
            {
                return rutaPwsh;
            }
        }
        catch
        {
            // Si algo falla al resolver la ruta, se recurre al valor por defecto.
        }

        return "powershell.exe";
    }
}
