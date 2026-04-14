using UnityEngine;

/// <summary>
/// A 3D card with double-sided rendering and spring-based physics animation.
/// Front face at z=+0.005, back face at z=-0.005 (rotated 180 on Y).
/// Aspect ratio 240/375 (width/height).
/// </summary>
public class CardEntity
{
    private const float CARD_ASPECT = 240f / 375f;
    private const float STIFFNESS = 200f;
    private const float DAMPING = 30f;

    public GameObject root;
    public GameObject flipGroup;
    public GameObject frontMesh;
    public GameObject backMesh;

    // Spring state
    private float velX, velY, velZ;
    private float velRotZ;
    private float velFlipY;
    private float velScale;

    // Current animated flip angle (tracked internally; localEulerAngles.y is
    // ambiguous at the 180° singularity — Unity decomposes Quaternion.Euler(0,180,0)
    // as (180, 0, 180), so reading .y back returns 0 instead of 180).
    private float currentFlipY;
    private float currentRotZ;

    // Targets
    public Vector3 targetPosition;
    public float targetRotZ;
    public float targetFlipY; // PI = face up (frontMesh exposed), 0 = face down (backMesh exposed). See CreateQuadMesh for why the "up" state is π rather than 0.
    public float targetScale = 1f;

    // Shake
    public bool shake;
    private float shakeTime;

    // Initial position system
    private bool mounted;
    private Vector3? initialPosition;

    // Materials
    private Material frontMaterial;
    private Material backMaterial;
    private static Material backTextureMaterial;

    public string Key { get; private set; }

    public CardEntity(string key, Texture2D frontTexture, Texture2D backTexture, Vector3? initPos = null)
    {
        Key = key;
        initialPosition = initPos;
        mounted = false;

        root = new GameObject($"Card_{key}");
        flipGroup = new GameObject("FlipGroup");
        flipGroup.transform.SetParent(root.transform, false);

        // Front face
        frontMesh = CreateCardPlane("Front", new Vector3(0, 0, 0.005f), Quaternion.identity, frontTexture);
        frontMesh.transform.SetParent(flipGroup.transform, false);

        // Back face (rotated 180 on Y)
        backMesh = CreateCardPlane("Back", new Vector3(0, 0, -0.005f), Quaternion.Euler(0, 180, 0), backTexture);
        backMesh.transform.SetParent(flipGroup.transform, false);
    }

    private GameObject CreateCardPlane(string name, Vector3 localPos, Quaternion localRot, Texture2D texture)
    {
        var go = new GameObject(name);
        var mf = go.AddComponent<MeshFilter>();
        var mr = go.AddComponent<MeshRenderer>();

        mf.mesh = CreateQuadMesh();
        go.transform.localPosition = localPos;
        go.transform.localRotation = localRot;

        var mat = new Material(Shader.Find("Unlit/Transparent Cutout"));
        mat.mainTexture = texture;
        mat.SetFloat("_Cutoff", 0.5f);
        mr.material = mat;

        if (name == "Front")
            frontMaterial = mat;
        else
            backMaterial = mat;

        return go;
    }

    private static Mesh CreateQuadMesh()
    {
        var mesh = new Mesh();
        float hw = CARD_ASPECT * 0.5f;
        float hh = 0.5f;

        mesh.vertices = new Vector3[]
        {
            new Vector3(-hw, -hh, 0),
            new Vector3(hw, -hh, 0),
            new Vector3(hw, hh, 0),
            new Vector3(-hw, hh, 0),
        };
        mesh.uv = new Vector2[]
        {
            new Vector2(0, 0),
            new Vector2(1, 0),
            new Vector2(1, 1),
            new Vector2(0, 1),
        };
        // CW winding from +Z. The camera looks toward -Z, so its local "right"
        // maps to world -X — meaning a mesh visible from +Z renders with UVs
        // mirrored horizontally. To compensate, we always show a mesh that has
        // been rotated 180° around Y (frontMesh via flipGroup=π for face-up,
        // backMesh via its own local 180°Y for face-down); that rotation both
        // un-mirrors the UVs and makes the CW mesh front-facing under Cull Back.
        mesh.triangles = new int[] { 0, 2, 1, 0, 3, 2 };
        mesh.RecalculateNormals();
        return mesh;
    }

    public void SetTarget(Vector3 position, float rotZ, bool faceUp, float scale, bool shouldShake = false)
    {
        targetPosition = position;
        targetRotZ = rotZ;
        targetFlipY = faceUp ? Mathf.PI : 0f;
        targetScale = scale;
        shake = shouldShake;
    }

    public void SetFrontTexture(Texture2D texture)
    {
        if (frontMaterial != null)
            frontMaterial.mainTexture = texture;
    }

    public void Update(float dt)
    {
        dt = Mathf.Min(dt, 0.05f);

        if (!mounted)
        {
            mounted = true;
            if (initialPosition.HasValue)
            {
                // Start at initial position, face down (flipGroup Y=0 shows the backMesh)
                root.transform.position = initialPosition.Value;
                currentFlipY = 0f;
            }
            else
            {
                // Snap to target
                root.transform.position = targetPosition;
                currentFlipY = targetFlipY;
            }
            currentRotZ = targetRotZ;
            flipGroup.transform.localRotation = Quaternion.Euler(0, currentFlipY * Mathf.Rad2Deg, 0);
            root.transform.localEulerAngles = new Vector3(0, 0, currentRotZ * Mathf.Rad2Deg);
            root.transform.localScale = Vector3.one * targetScale;
            return;
        }

        // Spring: position X, Y
        SpringUpdate(ref velX, root.transform.position.x, targetPosition.x, dt, out float newX);
        SpringUpdate(ref velY, root.transform.position.y, targetPosition.y, dt, out float newY);

        // Position Z: snap up instantly, spring down
        float newZ;
        if (targetPosition.z > root.transform.position.z)
        {
            newZ = targetPosition.z;
            velZ = 0;
        }
        else
        {
            SpringUpdate(ref velZ, root.transform.position.z, targetPosition.z, dt, out newZ);
        }
        root.transform.position = new Vector3(newX, newY, newZ);

        // Spring: rotation Z (shortest-path)
        float rotDiff = targetRotZ - currentRotZ;
        while (rotDiff > Mathf.PI) rotDiff -= Mathf.PI * 2;
        while (rotDiff < -Mathf.PI) rotDiff += Mathf.PI * 2;
        float adjustedTargetRotZ = currentRotZ + rotDiff;
        SpringUpdate(ref velRotZ, currentRotZ, adjustedTargetRotZ, dt, out float newRotZ);
        currentRotZ = newRotZ;

        float displayRotZ = newRotZ;
        if (shake)
        {
            shakeTime += dt;
            displayRotZ += Mathf.Sin(shakeTime * 22f) * 0.06f + Mathf.Sin(shakeTime * 37f) * 0.03f;
        }
        root.transform.localEulerAngles = new Vector3(0, 0, displayRotZ * Mathf.Rad2Deg);

        // Spring: flip Y (shortest-path), tracked internally to avoid
        // localEulerAngles ambiguity at 180°.
        float flipDiff = targetFlipY - currentFlipY;
        while (flipDiff > Mathf.PI) flipDiff -= Mathf.PI * 2;
        while (flipDiff < -Mathf.PI) flipDiff += Mathf.PI * 2;
        float adjustedFlipTarget = currentFlipY + flipDiff;
        SpringUpdate(ref velFlipY, currentFlipY, adjustedFlipTarget, dt, out float newFlipY);
        currentFlipY = newFlipY;
        flipGroup.transform.localRotation = Quaternion.Euler(0, newFlipY * Mathf.Rad2Deg, 0);

        // Spring: scale
        SpringUpdate(ref velScale, root.transform.localScale.x, targetScale, dt, out float newScale);
        root.transform.localScale = Vector3.one * newScale;
    }

    private static void SpringUpdate(ref float velocity, float current, float target, float dt, out float newValue)
    {
        float acc = STIFFNESS * (target - current) - DAMPING * velocity;
        velocity += acc * dt;
        newValue = current + velocity * dt;
    }

    public void Destroy()
    {
        Object.Destroy(root);
    }
}
