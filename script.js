/* ============================================================
   Love.css — script.js
   Construye una rosa 2D con capas de DOM y la anima con GSAP.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ---------- Referencias a elementos del DOM ----------
    const card = document.getElementById('card');
    const overlay = document.getElementById('overlay');
    const glow = document.getElementById('glow');
    const stem = document.getElementById('stem');
    const leavesBox = document.getElementById('leaves');
    const bud = document.getElementById('bud');
    const petalsBox = document.getElementById('petals');
    const stamensBox = document.getElementById('stamens');
    const particlesBox = document.getElementById('particles');
    const finalMsg = document.getElementById('final-msg');
    const btn = document.getElementById('bloom-btn');
    const progressFill = document.getElementById('progress-fill');

    let STEM_HEIGHT = 0;
    let PETAL_SCALE = 1;
    let LEAF_SCALE = 1;
    let GLOW_SIZE = 0;

    function updateResponsiveScale() {
        STEM_HEIGHT = Math.round(Math.min(window.innerHeight * 0.48, window.innerWidth * 0.72));
        PETAL_SCALE = Math.max(0.55, Math.min(1.2, STEM_HEIGHT / 425));
        LEAF_SCALE = PETAL_SCALE * 1.35;
        GLOW_SIZE = Math.round(window.innerHeight * 0.6);
        glow.style.width = GLOW_SIZE + 'px';
        glow.style.height = GLOW_SIZE + 'px';
    }

    // Definición de los "anillos" de pétalos, de AFUERA hacia ADENTRO en el orden
    // en que se dibujan (el anillo exterior se pinta primero, para que los
    // pétalos interiores queden por encima y formen el capullo enrollado del
    // centro, como en una rosa real). Cada anillo cubre un arco angular propio
    // y los pétalos se superponen bastante entre sí (overlap) para evitar el
    // efecto "flor de papel / pinwheel" plano.
    const PETAL_RINGS = [
        // exterior: pétalos anchos y redondeados, con espacio para que respire la silueta
        { count: 48, size: 72, heightRatio: 1.35, arc: 320, rotOffset: 0, radius: 10, curl: 62, darkness: 0.75 },
        // medio: capa intercalada que da volumen a los laterales
        { count: 24, size: 54, heightRatio: 1.32, arc: 250, rotOffset: 18, radius: 6, curl: 42, darkness: 0.45 },
        // interior: pétalos inclinados hacia el centro, como una rosa cerrándose
        { count: 12, size: 40, heightRatio: 1.38, arc: 175, rotOffset: 10, radius: 3, curl: 24, darkness: 0.2 },
        // núcleo: pocos pétalos pequeños para ocultar el punto de unión
        { count: 6, size: 30, heightRatio: 1.4, arc: 120, rotOffset: 25, radius: 1, curl: 14, darkness: 0.05 }
    ];

    let petals = [];
    let leaves = [];
    let stamens = [];
    let particles = [];
    let timeline = null;

    // ---------- Utilidades ----------
    const rand = (min, max) => Math.random() * (max - min) + min;

    function clearChildren(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    // ---------- Construcción de la rosa ----------
    function buildRose() {
        clearChildren(petalsBox);
        clearChildren(leavesBox);
        clearChildren(stamensBox);
        clearChildren(particlesBox);
        petals = [];
        leaves = [];
        stamens = [];
        particles = [];

        // --- Pétalos, organizados en anillos que se superponen entre sí ---
        // Se dibujan primero los anillos exteriores (quedan "detrás") y al final
        // los interiores (quedan "delante"), formando el remolino característico
        // del centro de una rosa real.
        PETAL_RINGS.forEach((ring, ringIndex) => {
            const angleStep = ring.arc / ring.count;
            const angleJitter = 0;
            const startAngle = -90 - ring.arc / 2 + ring.rotOffset; // -90 = apuntando hacia arriba

            for (let i = 0; i < ring.count; i++) {
                const petal = document.createElement('div');
                petal.className = 'petal';

                const baseAngle = startAngle + i * angleStep + rand(-angleJitter, angleJitter);
                const size = (ring.size + rand(-3, 3)) * PETAL_SCALE;

                // Pequeño desplazamiento polar para que los pétalos no giren todos
                // sobre el mismo punto exacto (evita el efecto "molinillo" plano)
                const jitterRad = (baseAngle + rand(-10, 10)) * Math.PI / 180;
                const offsetX = Math.cos(jitterRad) * rand(0, ring.radius) * PETAL_SCALE;
                const offsetY = Math.sin(jitterRad) * rand(0, ring.radius) * -1 * PETAL_SCALE;

                petal.style.width = size + 'px';
                const height = size * ring.heightRatio;
                petal.style.height = height + 'px';
                petal.style.left = (-size / 2 + offsetX) + 'px';
                petal.style.top = (-height + offsetY) + 'px';

                // Los pétalos interiores son más oscuros y saturados; los exteriores,
                // más luminosos, imitando cómo la luz llega a las capas externas
                petal.style.filter = `brightness(${0.7 + ring.darkness * 0.55}) saturate(${1.05 + ring.darkness * 0.2})`;

                petalsBox.appendChild(petal);

                petals.push({
                    el: petal,
                    ring: ringIndex,
                    baseAngle,
                    openAngle: baseAngle + rand(-ring.curl, ring.curl) * 0.35,
                    finalScale: 0.9 + rand(-0.06, 0.06),
                    delay: ringIndex * 0.16 + i * 0.05
                });
            }
        });

        // --- Hojas alternadas a distintas alturas del tallo, siempre por debajo
        // de la zona donde se abren los pétalos para que no queden tapadas ---
        const leafSpecs = [
            { side: -1, height: STEM_HEIGHT * 0.18, rot: -32 },
            { side: 1, height: STEM_HEIGHT * 0.3, rot: 28 },
            { side: -1, height: STEM_HEIGHT * 0.42, rot: -28 },
            { side: 1, height: STEM_HEIGHT * 0.54, rot: 24 }
        ];
        leafSpecs.forEach(spec => {
            const leaf = document.createElement('div');
            leaf.className = 'leaf';
            leaf.style.bottom = spec.height + 'px';
            leaf.style.width = 46 * LEAF_SCALE + 'px';
            leaf.style.height = 26 * LEAF_SCALE + 'px';
            leaf.style.left = '0px';
            // La hoja arranca "cerrada" (escala 0); GSAP la abrirá aplicando
            // scaleX = side (para reflejar la hoja izquierda) y scaleY = 1
            leaf.style.transform = `scale(0) rotate(${spec.rot}deg)`;
            leavesBox.appendChild(leaf);
            leaves.push({ el: leaf, side: spec.side, rot: spec.rot });
        });

        // --- Estambres, agrupados cerca del centro de la flor ---
        const stamenCount = 10;
        for (let i = 0; i < stamenCount; i++) {
            const stamen = document.createElement('div');
            stamen.className = 'stamen';
            const angle = (360 / stamenCount) * i;
            const radius = rand(2, 10);
            const rad = angle * Math.PI / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;
            stamen.style.left = x + 'px';
            stamen.style.bottom = (y + 6) + 'px';
            stamen.style.transform = `rotate(${rand(-15, 15)}deg)`;
            stamensBox.appendChild(stamen);
            stamens.push(stamen);
        }

        // --- Partículas flotantes ---
        const particleCount = 22;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const x = rand(-90, 90);
            const y = rand(20, STEM_HEIGHT + 60);
            particle.style.left = x + 'px';
            particle.style.bottom = y + 'px';
            particlesBox.appendChild(particle);
            particles.push(particle);
        }
    }

    // ---------- Secuencia de floración ----------
    function startBloom() {
        if (timeline) timeline.kill();

        btn.disabled = true;

        const tl = gsap.timeline({
            defaults: { ease: 'power3.inOut' },
            onUpdate: () => {
                progressFill.style.width = (tl.progress() * 100).toFixed(1) + '%';
            },
            onComplete: () => {
                btn.disabled = false;
                btn.textContent = 'BLOOM AGAIN';
            }
        });

        // 1. Desvanecer la tarjeta
        tl.to(card, { opacity: 0.15, y: -10, duration: 0.8 }, 0);

        // 2. Overlay + resplandor
        tl.to(overlay, { opacity: 1, duration: 1.2 }, 0.1);
        tl.to(glow, { opacity: 1, scale: 1, duration: 1.6 }, 0.1);

        // 3. Crecimiento del tallo (y elementos que suben junto con él)
        tl.fromTo(stem,
            { height: 0 },
            { height: STEM_HEIGHT, duration: 1.4 },
            0.3
        );
        tl.fromTo([bud, petalsBox, stamensBox],
            { bottom: 0 },
            { bottom: STEM_HEIGHT, duration: 1.4 },
            0.3
        );

        // 4. Hojas apareciendo de forma escalonada
        leaves.forEach((l, i) => {
            tl.to(l.el, {
                scaleX: l.side,
                scaleY: 1,
                opacity: 1,
                rotate: l.rot,
                duration: 0.6,
                ease: 'back.out(2)'
            }, 1.2 + i * 0.25);
        });

        // Leve balanceo continuo de las hojas
        leaves.forEach((l, i) => {
            tl.to(l.el, {
                rotate: `+=${l.side * 6}`,
                duration: 1.8 + i * 0.2,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            }, 1.9);
        });

        // 5. El capullo crece antes de abrirse
        tl.to(bud, {
            scale: 1,
            duration: 0.9,
            ease: 'back.out(1.6)'
        }, 1.5);

        // 6. Apertura de los pétalos, anillo por anillo
        petals.forEach(p => {
            tl.fromTo(p.el,
                {
                    rotate: p.baseAngle,
                    scale: 0.05,
                    opacity: 0,
                    transformOrigin: '50% 100%'
                },
                {
                    rotate: p.openAngle,
                    scale: p.finalScale,
                    opacity: 1,
                    duration: 0.9,
                    ease: 'power3.out'
                },
                2.1 + p.delay
            );
        });

        // El capullo se desvanece detrás de los pétalos una vez que estos han crecido
        tl.to(bud, { opacity: 0.85, duration: 0.6 }, 2.6);

        // 7. Estambres asomando en el centro
        tl.to(stamens, {
            opacity: 1,
            duration: 0.5,
            stagger: 0.03
        }, 3.0);

        // 8. Partículas: aparecen y flotan de forma continua
        tl.to(particles, {
            opacity: () => rand(0.3, 0.9),
            duration: 0.8,
            stagger: 0.02
        }, 3.1);

        particles.forEach((particle, i) => {
            tl.to(particle, {
                x: `+=${rand(-40, 40)}`,
                y: `-=${rand(30, 90)}`,
                duration: rand(3, 6),
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            }, 3.2 + i * 0.05);
        });

        // 9. Mensaje final
        tl.fromTo(finalMsg,
            { opacity: 0, scale: 0.8, y: -20 },
            { opacity: 1, scale: 1, y: 0, duration: 1, ease: 'back.out(1.7)' },
            3.9
        );

        timeline = tl;
    }

    // ---------- Reinicio ----------
    function resetRose() {
        if (timeline) {
            timeline.kill();
            timeline = null;
        }

        gsap.set(card, { opacity: 1, y: 0 });
        gsap.set(overlay, { opacity: 0 });
        gsap.set(glow, { opacity: 0, scale: 0.6 });
        gsap.set(stem, { height: 0 });
        gsap.set([bud, petalsBox, stamensBox], { bottom: 0 });
        gsap.set(bud, { scale: 0, opacity: 1 });
        gsap.set(finalMsg, { opacity: 0, scale: 0.8, y: -20 });
        progressFill.style.width = '0%';

        buildRose();

        gsap.set(leaves.map(l => l.el), { opacity: 0, scale: 0 });
        gsap.set(petals.map(p => p.el), { opacity: 0, scale: 0.05 });
        gsap.set(stamens, { opacity: 0 });
        gsap.set(particles, { opacity: 0 });
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateResponsiveScale();
            resetRose();
        }, 150);
    });

    // ---------- Efecto ripple en el botón ----------
    function spawnRipple(event) {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height) * 1.4;
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);

        gsap.to(ripple, {
            scale: 1,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => ripple.remove()
        });
    }

    // ---------- Eventos ----------
    btn.addEventListener('click', (e) => {
        spawnRipple(e);
        if (btn.textContent.trim() === 'BLOOM AGAIN') {
            resetRose();
            // pequeño respiro antes de reiniciar la secuencia completa
            gsap.delayedCall(0.05, startBloom);
        } else {
            startBloom();
        }
    });

    // ---------- Inicialización ----------
    updateResponsiveScale();
    buildRose();
});