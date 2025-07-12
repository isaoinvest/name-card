/* global AFRAME, THREE */
AFRAME.registerComponent('hologram-effect', {
  schema: {
    color: {type: 'color', default: '#00ffff'},
    emissiveColor: {type: 'color', default: '#00ffff'},
    opacity: {type: 'number', default: 0.7},
    emissiveIntensity: {type: 'number', default: 2.0},
    scanlineSpeed: {type: 'number', default: 10.0},
    glitchSpeed: {type: 'number', default: 5.0},
    fresnelPower: {type: 'number', default: 2.0}
  },

  init: function () {
    const el = this.el;
    this.shader = null; // To store the compiled shader

    // Wait for the model to be loaded
    el.addEventListener('model-loaded', () => {
      const model = el.object3D;
      if (!model) {
        console.error("Hologram component could not find a mesh on the element.");
        return;
      }
      
      const hologramMaterial = this.createHologramMaterial();

      // Apply the material to all meshes in the model
      model.traverse(node => {
        if (node.isMesh) {
          node.material = hologramMaterial;
        }
      });
    });
  },

  createHologramMaterial: function() {
    const data = this.data;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      transparent: true,
      opacity: data.opacity,
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(data.emissiveColor),
      emissiveIntensity: data.emissiveIntensity,
      side: THREE.DoubleSide, // Render both sides to avoid invisible parts
    });

    // Inject custom shader logic
    material.onBeforeCompile = shader => {
      shader.uniforms.time = { value: 0 };
      shader.uniforms.scanlineSpeed = { value: data.scanlineSpeed };
      shader.uniforms.glitchSpeed = { value: data.glitchSpeed };
      shader.uniforms.fresnelPower = { value: data.fresnelPower };

      // Add uniforms to the shader code
      shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
      shader.fragmentShader = 'uniform float time;\nuniform float scanlineSpeed;\nuniform float glitchSpeed;\nuniform float fresnelPower;\n' + shader.fragmentShader;

      // Vertex shader for glitch effect
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float glitchEffect = sin(position.y * 20.0 + time * glitchSpeed) * 0.03;
        transformed.x += glitchEffect;
        transformed.z += glitchEffect;
        `
      );

      // Fragment shader for scanlines and fresnel effect
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        // Scanlines
        float scanline = sin(vUv.y * 400.0 - time * scanlineSpeed) * 0.1;
        gl_FragColor.rgb += vec3(scanline) * 0.2;

        // Glitchy transparency stripes
        if (fract(vUv.y * 7.0 - time * 0.2) > 0.98) {
          gl_FragColor.a = 0.0;
        }

        // Fresnel effect for glowing edges
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = 1.0 - dot(normalize(vNormal), -viewDirection);
        fresnel = pow(fresnel, fresnelPower);
        gl_FragColor.a *= (fresnel + 0.2); // Combine fresnel with base opacity
        gl_FragColor.rgb += fresnel * 0.3; // Add a bit of glow to the edges
        `
      );
      
      this.shader = shader; // Save the shader for the tick handler
    };

    return material;
  },

  tick: function (time, timeDelta) {
    // Update the 'time' uniform in the shader on each frame
    if (this.shader) {
      this.shader.uniforms.time.value = time / 1000; // Time in seconds
    }
  }
});
