using UnityEngine;

/// <summary>
/// Helper class for color picker circle positioning and interaction.
/// The actual color picker logic is handled by GameManager.
/// This class provides utility constants and color mapping.
/// </summary>
public static class ColorPicker
{
    public static readonly string[] Colors = { "red", "yellow", "green", "blue" };
    public const float RADIUS = 0.6f;
    public const float CIRCLE_RADIUS = 0.35f;
    public const float STAGGER_DELAY = 0.08f;

    /// <summary>
    /// Get the position of a color picker circle by index.
    /// </summary>
    public static Vector3 GetCirclePosition(int index)
    {
        float angle = (index / 4f) * Mathf.PI * 2f - Mathf.PI / 4f;
        return new Vector3(
            Mathf.Cos(angle) * RADIUS,
            Mathf.Sin(angle) * RADIUS,
            2f
        );
    }

    /// <summary>
    /// Convert a UNO color name to a Unity Color.
    /// </summary>
    public static Color GetColor(string colorName)
    {
        switch (colorName)
        {
            case "red":    return new Color(1f, 0.2f, 0.2f);      // #ff3333
            case "blue":   return new Color(0.2f, 0.467f, 1f);     // #3377ff
            case "green":  return new Color(0.2f, 0.733f, 0.267f); // #33bb44
            case "yellow": return new Color(1f, 0.8f, 0f);         // #ffcc00
            default:       return Color.white;
        }
    }
}
