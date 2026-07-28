// ====================================================================================
// Launcher para Diagnostico-Hardware.ps1
// ====================================================================================
// Este ejecutable no contiene logica de diagnostico: su unico proposito es servir
// como punto de entrada nativo (.exe) que, gracias al manifiesto embebido
// (app.manifest, requestedExecutionLevel="requireAdministrator"), hace que Windows
// muestre el dialogo de UAC ("¿Deseas permitir que esta app haga cambios...")
// automaticamente al abrirse si el usuario no esta ejecutando como Administrador.
//
// Una vez concedido el permiso, este programa localiza Diagnostico-Hardware.ps1
// (debe estar en la misma carpeta que el .exe) y lo ejecuta con PowerShell en
// modo STA, requerido por la interfaz grafica (WinForms) del script.
//
// Compilacion: usar build.bat (incluido), que utiliza csc.exe de .NET Framework,
// ya presente en Windows 10/11 sin necesidad de instalar nada adicional.
// ====================================================================================

using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Launcher
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string carpetaBase = AppDomain.CurrentDomain.BaseDirectory;
            string rutaScript = Path.Combine(carpetaBase, "Diagnostico-Hardware.ps1");

            if (!File.Exists(rutaScript))
            {
                MessageBox.Show(
                    "No se encontro el archivo 'Diagnostico-Hardware.ps1' junto al ejecutable." +
                    Environment.NewLine + Environment.NewLine +
                    "Ruta esperada:" + Environment.NewLine + rutaScript,
                    "Diagnostico de Hardware",
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
                // El launcher no necesita esperar: el propio script maneja su ciclo
                // de vida completo (consola + formulario). Si se prefiere que el
                // launcher permanezca abierto hasta que el diagnostico termine,
                // descomentar la siguiente linea:
                // if (proceso != null) proceso.WaitForExit();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "No se pudo iniciar la herramienta de diagnostico:" +
                Environment.NewLine + Environment.NewLine + ex.Message,
                "Diagnostico de Hardware",
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
