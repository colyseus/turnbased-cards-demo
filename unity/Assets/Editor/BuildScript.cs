using UnityEditor;
using UnityEngine;

public class BuildScript
{
    public static void BuildWebGL()
    {
        string outputPath = System.Environment.GetEnvironmentVariable("BUILD_OUTPUT_PATH");
        if (string.IsNullOrEmpty(outputPath))
            outputPath = "../BUILDS/unity";

        string[] scenes = new string[EditorBuildSettings.scenes.Length];
        for (int i = 0; i < EditorBuildSettings.scenes.Length; i++)
            scenes[i] = EditorBuildSettings.scenes[i].path;

        // Fallback if no scenes are configured in Build Settings
        if (scenes.Length == 0)
            scenes = new string[] { "Assets/Scenes/Main.unity" };

        // Disable compression so builds work on any static file server
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;

        var options = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = outputPath,
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };

        var report = BuildPipeline.BuildPlayer(options);

        if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
        {
            Debug.LogError("WebGL build failed: " + report.summary.totalErrors + " error(s)");
            EditorApplication.Exit(1);
        }
        else
        {
            Debug.Log("WebGL build succeeded: " + outputPath);
        }
    }
}
