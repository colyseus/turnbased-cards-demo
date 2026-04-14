using UnityEngine;

/// <summary>
/// Helper class for turn indicator calculations.
/// Actual turn indicator rendering and animation is handled by GameManager.
/// This provides utility constants and calculations.
/// </summary>
public static class TurnIndicator
{
    // Player angles: 0=bottom(-PI/2), 1=left(PI), 2=top(PI/2), 3=right(0)
    public static readonly float[] PlayerAngles = { -Mathf.PI / 2f, Mathf.PI, Mathf.PI / 2f, 0f };

    // Spring parameters (softer than card spring)
    public const float STIFFNESS = 120f;
    public const float DAMPING = 22f;

    /// <summary>
    /// Calculate turn indicator radius from viewport dimensions.
    /// </summary>
    public static float CalculateRadius(float viewportWidth, float viewportHeight)
    {
        return Mathf.Min(viewportHeight * 0.28f, viewportWidth * 0.32f);
    }

    /// <summary>
    /// Get the position of a direction arrow by index.
    /// </summary>
    public static Vector3 GetDirectionArrowPosition(int index, float radius, int direction)
    {
        float a = (index / 4f) * Mathf.PI * 2f + Mathf.PI / 4f;
        return new Vector3(
            Mathf.Cos(a) * radius * 0.85f,
            Mathf.Sin(a) * radius * 0.85f,
            0
        );
    }

    /// <summary>
    /// Get the rotation angle for a direction arrow.
    /// </summary>
    public static float GetDirectionArrowAngle(int index, int direction)
    {
        float a = (index / 4f) * Mathf.PI * 2f + Mathf.PI / 4f;
        return a + (direction == 1 ? -Mathf.PI / 2f : Mathf.PI / 2f);
    }
}
