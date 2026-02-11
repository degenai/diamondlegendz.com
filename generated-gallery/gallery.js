// 20 Generated Assets Gallery Script

document.addEventListener('DOMContentLoaded', () => {
    const galleryTable = document.getElementById('gallery-table');

    // Array of generator objects
    // Each has: name, type, render(containerId)
    const generators = [
        // --- VANILLA JS (10) ---
        {
            name: "1. Retro Noise (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                function draw() {
                    const w = canvas.width;
                    const h = canvas.height;
                    const idata = ctx.createImageData(w, h);
                    const buffer32 = new Uint32Array(idata.data.buffer);
                    const len = buffer32.length;
                    for (let i = 0; i < len; i++) {
                        if (Math.random() < 0.5) buffer32[i] = 0xff000000;
                        else buffer32[i] = 0xffffffff;
                    }
                    ctx.putImageData(idata, 0, 0);
                    requestAnimationFrame(draw);
                }
                draw();
            }
        },
        {
            name: "2. Bouncing Balls (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                const balls = Array.from({length: 10}, () => ({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
                    r: 5 + Math.random() * 10
                }));

                function animate() {
                    ctx.fillStyle = 'rgba(0,0,0,0.1)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    balls.forEach(b => {
                        b.x += b.vx;
                        b.y += b.vy;
                        if(b.x < 0 || b.x > canvas.width) b.vx *= -1;
                        if(b.y < 0 || b.y > canvas.height) b.vy *= -1;

                        ctx.beginPath();
                        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                        ctx.fillStyle = b.color;
                        ctx.fill();
                    });
                    requestAnimationFrame(animate);
                }
                animate();
            }
        },
        {
            name: "3. Matrix Rain (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                const cols = Math.floor(canvas.width / 20) + 1;
                const ypos = Array(cols).fill(0);

                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                function step() {
                    ctx.fillStyle = '#0001';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = '#0f0';
                    ctx.font = '15pt monospace';

                    ypos.forEach((y, index) => {
                        const text = String.fromCharCode(Math.random() * 128);
                        const x = index * 20;
                        ctx.fillText(text, x, y);
                        if (y > 100 + Math.random() * 10000) ypos[index] = 0;
                        else ypos[index] = y + 20;
                    });
                }
                setInterval(step, 50);
            }
        },
        {
            name: "4. Sine Wave (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                let offset = 0;

                function animate() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.beginPath();
                    ctx.moveTo(0, canvas.height / 2);
                    for (let i = 0; i < canvas.width; i++) {
                        ctx.lineTo(i, canvas.height / 2 + Math.sin(i * 0.05 + offset) * 50);
                    }
                    ctx.strokeStyle = 'cyan';
                    ctx.stroke();
                    offset += 0.1;
                    requestAnimationFrame(animate);
                }
                animate();
            }
        },
        {
            name: "5. Starfield (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                const stars = Array.from({length: 100}, () => ({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    z: Math.random() * canvas.width
                }));

                function move() {
                    ctx.fillStyle = "black";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = "white";

                    stars.forEach(star => {
                        star.z -= 2;
                        if (star.z <= 0) {
                            star.z = canvas.width;
                            star.x = Math.random() * canvas.width;
                            star.y = Math.random() * canvas.height;
                        }

                        const k = 128.0 / star.z;
                        const px = (star.x - canvas.width / 2) * k + canvas.width / 2;
                        const py = (star.y - canvas.height / 2) * k + canvas.height / 2;

                        if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
                            const size = (1 - star.z / canvas.width) * 3;
                            ctx.fillRect(px, py, size, size);
                        }
                    });
                    requestAnimationFrame(move);
                }
                move();
            }
        },
        {
            name: "6. Random Rects (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                setInterval(() => {
                    const x = Math.random() * canvas.width;
                    const y = Math.random() * canvas.height;
                    const w = Math.random() * 50;
                    const h = Math.random() * 50;
                    ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.5)`;
                    ctx.fillRect(x, y, w, h);

                    // Fade out
                    ctx.fillStyle = "rgba(0,0,0,0.05)";
                    ctx.fillRect(0,0,canvas.width, canvas.height);
                }, 100);
            }
        },
        {
            name: "7. Cursor Tracker (Vanilla)",
            render: (container) => {
                container.style.position = 'relative';
                container.style.backgroundColor = '#220022';
                const eye1 = document.createElement('div');
                const eye2 = document.createElement('div');
                [eye1, eye2].forEach(eye => {
                    eye.style.width = '20px';
                    eye.style.height = '20px';
                    eye.style.background = 'white';
                    eye.style.borderRadius = '50%';
                    eye.style.position = 'absolute';
                    eye.style.top = '90px';
                    const pupil = document.createElement('div');
                    pupil.style.width = '8px';
                    pupil.style.height = '8px';
                    pupil.style.background = 'black';
                    pupil.style.borderRadius = '50%';
                    pupil.style.position = 'relative';
                    pupil.style.top = '6px';
                    pupil.style.left = '6px';
                    eye.appendChild(pupil);
                    container.appendChild(eye);
                });
                eye1.style.left = '30%';
                eye2.style.left = '60%';

                container.addEventListener('mousemove', (e) => {
                    const rect = container.getBoundingClientRect();
                    [eye1, eye2].forEach(eye => {
                        const pupil = eye.firstChild;
                        const eyeX = rect.left + eye.offsetLeft + 10;
                        const eyeY = rect.top + eye.offsetTop + 10;
                        const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
                        pupil.style.transform = `translate(${Math.cos(angle) * 5}px, ${Math.sin(angle) * 5}px)`;
                    });
                });
            }
        },
        {
            name: "8. Text Scramble (Vanilla)",
            render: (container) => {
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
                container.style.fontFamily = 'monospace';
                container.style.fontSize = '1.5em';
                container.style.color = '#0f0';

                const el = document.createElement('div');
                container.appendChild(el);
                const chars = "!@#$%^&*()_+{}|:<>?";

                setInterval(() => {
                    let str = "";
                    for(let i=0; i<8; i++) {
                        str += chars[Math.floor(Math.random() * chars.length)];
                    }
                    el.innerText = str;
                }, 100);
            }
        },
        {
            name: "9. Kaleidoscope (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                let angle = 0;

                function draw() {
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;

                    // Fade
                    ctx.fillStyle = "rgba(0,0,0,0.1)";
                    ctx.fillRect(0,0,canvas.width, canvas.height);

                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);

                    for(let i=0; i<6; i++) {
                        ctx.rotate(Math.PI / 3);
                        ctx.beginPath();
                        ctx.moveTo(0,0);
                        ctx.lineTo(50, 0);
                        ctx.strokeStyle = `hsl(${angle * 50}, 100%, 50%)`;
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(60, 0, 5, 0, Math.PI*2);
                        ctx.fillStyle = `hsl(${angle * 50 + 180}, 100%, 50%)`;
                        ctx.fill();
                    }

                    ctx.restore();
                    angle += 0.05;
                    requestAnimationFrame(draw);
                }
                draw();
            }
        },
        {
            name: "10. Spiral (Vanilla)",
            render: (container) => {
                const canvas = document.createElement('canvas');
                canvas.width = container.clientWidth;
                canvas.height = 200;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                let t = 0;

                function draw() {
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(0,0,canvas.width, canvas.height);

                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2;
                    const x = cx + Math.cos(t) * t * 2;
                    const y = cy + Math.sin(t) * t * 2;

                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI*2);
                    ctx.fillStyle = 'yellow';
                    ctx.fill();

                    t += 0.1;
                    if(t > 50) t = 0;
                    requestAnimationFrame(draw);
                }
                draw();
            }
        },

        // --- D3.JS (5) ---
        {
            name: "11. Random Bars (D3)",
            render: (container) => {
                const data = Array.from({length: 20}, () => Math.random() * 100);
                const w = container.clientWidth;
                const h = 200;

                const svg = d3.select(container).append("svg")
                    .attr("width", w)
                    .attr("height", h);

                function update() {
                    const newData = Array.from({length: 20}, () => Math.random() * 100);
                    const bars = svg.selectAll("rect").data(newData);

                    bars.enter().append("rect")
                        .merge(bars)
                        .transition().duration(1000)
                        .attr("x", (d, i) => i * (w / 20))
                        .attr("y", d => h - d*1.5)
                        .attr("width", (w / 20) - 2)
                        .attr("height", d => d*1.5)
                        .attr("fill", d => d > 50 ? "orange" : "purple");

                    bars.exit().remove();
                }
                update();
                setInterval(update, 1500);
            }
        },
        {
            name: "12. Force Nodes (D3)",
            render: (container) => {
                const w = container.clientWidth;
                const h = 200;
                const svg = d3.select(container).append("svg").attr("width", w).attr("height", h);

                const nodes = d3.range(20).map(i => ({r: Math.random() * 10 + 5}));

                const simulation = d3.forceSimulation(nodes)
                    .force("charge", d3.forceManyBody().strength(5))
                    .force("center", d3.forceCenter(w / 2, h / 2))
                    .force("collision", d3.forceCollide().radius(d => d.r + 1))
                    .on("tick", ticked);

                const circles = svg.selectAll("circle")
                    .data(nodes)
                    .enter().append("circle")
                    .attr("r", d => d.r)
                    .attr("fill", (d, i) => d3.schemeCategory10[i % 10]);

                function ticked() {
                    circles
                        .attr("cx", d => d.x)
                        .attr("cy", d => d.y);
                }

                // Agitate
                setInterval(() => {
                    simulation.alpha(1).restart();
                }, 2000);
            }
        },
        {
            name: "13. Circles (D3)",
            render: (container) => {
                 const w = container.clientWidth;
                const h = 200;
                const svg = d3.select(container).append("svg").attr("width", w).attr("height", h);

                let t = 0;

                function animate() {
                   svg.selectAll("*").remove();
                   const data = d3.range(10).map(i => ({
                       x: w/2 + Math.cos(t + i) * 50,
                       y: h/2 + Math.sin(t + i) * 50,
                       r: 10 + Math.sin(t*2 + i)*5
                   }));

                   svg.selectAll("circle")
                    .data(data)
                    .enter().append("circle")
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y)
                    .attr("r", d => d.r)
                    .attr("fill", "cyan")
                    .attr("stroke", "white");

                   t += 0.05;
                   requestAnimationFrame(animate);
                }
                animate();
            }
        },
        {
            name: "14. Voronoi-ish (D3)",
            render: (container) => {
                // Actually simple paths since d3-delaunay is separate usually
                const w = container.clientWidth;
                const h = 200;
                const svg = d3.select(container).append("svg").attr("width", w).attr("height", h);

                function draw() {
                    svg.selectAll("*").remove();
                    const points = d3.range(50).map(() => [Math.random() * w, Math.random() * h]);

                    svg.selectAll("path")
                       .data(points)
                       .enter()
                       .append("circle")
                       .attr("cx", d => d[0])
                       .attr("cy", d => d[1])
                       .attr("r", 2)
                       .attr("fill", "lime");

                    // Connect some random lines
                    svg.selectAll("line")
                        .data(d3.range(20))
                        .enter().append("line")
                        .attr("x1", () => points[Math.floor(Math.random()*50)][0])
                        .attr("y1", () => points[Math.floor(Math.random()*50)][1])
                        .attr("x2", () => points[Math.floor(Math.random()*50)][0])
                        .attr("y2", () => points[Math.floor(Math.random()*50)][1])
                        .attr("stroke", "rgba(0,255,0,0.3)");
                }
                draw();
                setInterval(draw, 1000);
            }
        },
        {
            name: "15. Pie Pulse (D3)",
            render: (container) => {
                const w = container.clientWidth;
                const h = 200;
                const svg = d3.select(container).append("svg").attr("width", w).attr("height", h)
                    .append("g").attr("transform", `translate(${w/2},${h/2})`);

                const pie = d3.pie().value(d => d);
                const arc = d3.arc().innerRadius(0).outerRadius(50);

                function update() {
                    const data = [Math.random(), Math.random(), Math.random(), Math.random()];
                    const paths = svg.selectAll("path").data(pie(data));

                    paths.enter().append("path")
                        .merge(paths)
                        .attr("d", arc)
                        .attr("fill", (d,i) => ["red", "blue", "yellow", "green"][i])
                        .transition()
                        .attr("transform", `scale(${0.8 + Math.random() * 0.4})`);
                }
                setInterval(update, 500);
            }
        },

        // --- ANIME.JS (5) ---
        {
            name: "16. Grid Stagger (Anime)",
            render: (container) => {
                container.style.display = "grid";
                container.style.gridTemplateColumns = "repeat(5, 1fr)";
                container.style.gap = "2px";

                for(let i=0; i<25; i++) {
                    const div = document.createElement("div");
                    div.style.backgroundColor = "magenta";
                    div.style.height = "100%";
                    container.appendChild(div);
                }

                anime({
                    targets: container.children,
                    scale: [
                        {value: .1, easing: 'easeOutSine', duration: 500},
                        {value: 1, easing: 'easeInOutQuad', duration: 1200}
                    ],
                    delay: anime.stagger(100, {grid: [5, 5], from: 'center'}),
                    loop: true
                });
            }
        },
        {
            name: "17. Rotating Squares (Anime)",
            render: (container) => {
                const div = document.createElement("div");
                div.style.width = "50px";
                div.style.height = "50px";
                div.style.backgroundColor = "cyan";
                div.style.margin = "75px auto";
                container.appendChild(div);

                anime({
                    targets: div,
                    rotate: '1turn',
                    borderRadius: ['0%', '50%'],
                    backgroundColor: '#FFF',
                    duration: 2000,
                    loop: true,
                    direction: 'alternate'
                });
            }
        },
        {
            name: "18. Path Trace (Anime)",
            render: (container) => {
                const w = container.clientWidth;
                const h = 200;
                // Simple SVG path
                container.innerHTML = `
                    <svg width="${w}" height="${h}" viewBox="0 0 200 200">
                        <path id="path1" d="M10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="yellow" stroke-width="5" fill="none"/>
                    </svg>
                `;

                anime({
                    targets: container.querySelector('path'),
                    strokeDashoffset: [anime.setDashoffset, 0],
                    easing: 'easeInOutSine',
                    duration: 1500,
                    delay: function(el, i) { return i * 250 },
                    direction: 'alternate',
                    loop: true
                });
            }
        },
        {
            name: "19. Bouncing Text (Anime)",
            render: (container) => {
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
                container.style.fontSize = "2em";

                const text = "BOUNCE".split("");
                text.forEach(char => {
                    const span = document.createElement("span");
                    span.innerText = char;
                    span.style.color = "lime";
                    span.style.display = "inline-block";
                    container.appendChild(span);
                });

                anime({
                    targets: container.querySelectorAll('span'),
                    translateY: -20,
                    direction: 'alternate',
                    loop: true,
                    delay: anime.stagger(100),
                    easing: 'spring(1, 80, 10, 0)'
                });
            }
        },
        {
            name: "20. Orbit (Anime)",
            render: (container) => {
                container.style.position = 'relative';
                const circle = document.createElement('div');
                circle.style.width = '20px';
                circle.style.height = '20px';
                circle.style.backgroundColor = 'red';
                circle.style.borderRadius = '50%';
                circle.style.position = 'absolute';
                circle.style.top = '90px';
                circle.style.left = '90px';
                container.appendChild(circle);

                anime({
                    targets: circle,
                    translateX: 50,
                    rotate: '1turn',
                    duration: 1000,
                    loop: true,
                    easing: 'linear'
                });
            }
        }
    ];

    // Build Layout
    // 3 columns
    let currentRow;
    generators.forEach((gen, index) => {
        if (index % 3 === 0) {
            currentRow = document.createElement('tr');
            galleryTable.appendChild(currentRow);
        }

        const cell = document.createElement('td');

        const title = document.createElement('div');
        title.className = 'asset-title';
        title.innerText = gen.name;
        cell.appendChild(title);

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'asset-canvas-container';
        // Unique ID for safety if needed, but passing element is better
        cell.appendChild(canvasContainer);

        currentRow.appendChild(cell);

        // Render
        // Timeout to ensure layout is done and sizes are correct
        setTimeout(() => {
            try {
                gen.render(canvasContainer);
            } catch(e) {
                console.error(`Error rendering ${gen.name}:`, e);
                canvasContainer.innerText = "Error: " + e.message;
            }
        }, 100);
    });
});
