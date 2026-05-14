'use strict';

window.addEventListener('load', function setupCanvas(e) {
    this.window.removeEventListener(e.type, setupCanvas, false);
    setup();
});

class RGB {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

function renderCanvas(canvas) {
    let img = new ImageData(canvas.pixels, canvas.w, canvas.h);
    canvas.ctx.putImageData(img, 0, 0);
}

function draw(canvas, x, y, r, g, b, a=255) {
    x = Math.floor(x)
    y = Math.floor(y)
    let i = canvas.w * y * 4 + x * 4
    canvas.pixels[i] = r;
    canvas.pixels[i+1] = g;
    canvas.pixels[i+2] = b;
    canvas.pixels[i+3] = a;
}

function rotate(a, b, cos, sin) {
    let newa = a * cos + b * sin;
    let newb = -a * sin + b * cos;
    return {a: newa, b: newb};
}

function circle(canvas, x, y, depth, rad, r, g, b) {
    // should I really do this?
    if (x + rad < 0 || x - rad > canvas.width) {return;}
    let rsquared = Math.pow(rad, 2)
    for (let i = Math.floor(x-rad); i <= x + rad; i++) {
        if (i < 0) {i = 0;}
        if (i >= canvas.w) {return;}
        let newy = Math.sqrt(rsquared - Math.pow(i - x, 2));
        if (y + newy < 0) {continue;}
        for (let j = Math.floor(y-newy); j < y+newy; j++) {
            if (j < 0) {j = 0}
            if (j > canvas.h) {break;}
            let m = j * canvas.w + i;

            if (canvas.depth[m] > depth) {
                canvas.depth[m] = depth
                draw(canvas, i, j, r, g, b);
            }
        }
    }
}

function sphere(canvas, cam, x, y, z, rad, rgb) {
    let relx = x - cam.x;
    let rely = -y + cam.y;
    let relz = z - cam.z;


    let rotated = rotate(relx, relz, Math.cos(cam.xr), Math.sin(cam.xr));

    let newx = rotated.a;

    rotated = rotate(rely, rotated.b, Math.cos(cam.yr), Math.sin(cam.yr));

    let newz = rotated.b
    if (newz < 1) {return;}
    let newy = rotated.a;
    let newrad = rad*canvas.w / newz;

    let shade = 50/newz;
    if (shade > 1) {shade = 1;}
    circle(canvas, (newx/newz + 1/2)*canvas.w, (newy/newz + 1/2)*canvas.w, newz, newrad, rgb.r*shade, rgb.g*shade, rgb.b*shade);
}

function move(cam, direction, amount) {
    cam.x -= Math.sin(direction) * amount;
    cam.z += Math.cos(direction) * amount;
}

function controls(keys, cam) {

    if (keys.has('ArrowUp')) {cam.yr += 0.02;}
    if (keys.has('ArrowDown')) {cam.yr -= 0.02;}
    if (keys.has('ArrowLeft')) {cam.xr += 0.02;}
    if (keys.has('ArrowRight')) {cam.xr -= 0.02;}

    if (keys.has('KeyW')) {move(cam, cam.xr, 1)}
    if (keys.has('KeyS')) {move(cam, cam.xr, -1)}
    if (keys.has('KeyA')) {move(cam, cam.xr - Math.PI/2, -1)}
    if (keys.has('KeyD')) {move(cam, cam.xr - Math.PI/2, 1)}
    if (keys.has('Space')) {cam.y += 1;}
    if (keys.has('ShiftLeft')) {cam.y -= 1}
}

function setup() {
    // https://files.rcsb.org/view/2HHB.pdb
    // https://files.rcsb.org/view/1MBN.pdb
    // https://files.rcsb.org/view/6VG7.pdb // multiple models, that's what's wrong
    // https://files.rcsb.org/view/1K6F.pdb
    // https://files.rcsb.org/view/1GFL.pdb
    // https://files.rcsb.org/view/4Y2N.pdb // should it be repeated or something?
    // https://files.rcsb.org/view/1BPZ.pdb
    // https://files.rcsb.org/view/4TNA.pdb
    // https://files.rcsb.org/view/7U1T.pdb
    fetch('https://files.rcsb.org/view/7U1T.pdb').then(res => {res.text().then(res => init(res));});
}

function init(pdb) {
    requestAnimationFrame(tick);
    let lines = pdb.split("\n")
    let atoms = []
    for (let line of lines) {
        if (line.slice(0, 4) == 'ATOM' || line.slice(0, 6) == 'HETATM') {
            atoms.push(line)
        }
    }

    let canvas = {};
    canvas.canvas = document.querySelector("canvas");
    canvas.ctx = canvas.canvas.getContext('2d');
    canvas.w = Number(canvas.canvas.getAttribute('width'));
    canvas.h = Number(canvas.canvas.getAttribute('height'));
    canvas.pixels = new Uint8ClampedArray(canvas.w * canvas.h * 4);
    let i = 0;
    let cam = {
        x: -2,
        y: 0,
        z: -100,
        xr: 0,
        yr: 0
    }

    let pressedKeys = new Set()
    document.addEventListener('keydown', (evt) => {
        pressedKeys.add(evt.code);
    });
    document.addEventListener('keyup', (evt) => {
        pressedKeys.delete(evt.code);
    })

    let darkGreen = new RGB(2, 98, 10);
    let green = new RGB(0, 198, 7);

    let colors = {
        H: new RGB(230, 230, 230),
        C: new RGB(30, 30, 30),
        N: new RGB(0, 0, 255),
        O: new RGB(255, 0, 0),
        S: new RGB(255, 255, 0),
        FE: new RGB(255, 109, 5),
        P: new RGB(252, 164, 0),
        MG: darkGreen,
        BE: darkGreen,
        CA: darkGreen,
        SR: darkGreen,
        BA: darkGreen,
        RA: darkGreen,
        F: green,
        CL: green,
        TI: new RGB(109, 109, 109),

    }

    function tick() {
        renderCanvas(canvas);
        for (let i = 0; i < canvas.pixels.length; i++) {canvas.pixels[i] = 0;}

        canvas.depth = new Array(canvas.w * canvas.h).fill(Infinity); // inefficient?
        for (let line of atoms) {
            let linesplit = line.trim().split(/\s+/);
            let coords = linesplit.slice(6, 9);
            let type = line.slice(76, 78).trim();
            let rgb = new RGB(247, 192, 196);
            if (Object.hasOwn(colors, type)) {
                rgb = colors[type];
            } else {
                console.log(type);
                console.log(line)
            }
            sphere(canvas, cam, coords[0], coords[1], coords[2], 0.8, rgb);
        }
        i++;
        controls(pressedKeys, cam);
        if (pressedKeys.has("KeyJ")) {
            let pdb = prompt("Type URL of .pdb file here:")
            if (pdb.length == 4) {pdb = `https://files.rcsb.org/view/${pdb}.pdb`}
            fetch(pdb).then(res => {res.text().then(res => init(res));});
        } else {
            requestAnimationFrame(tick);
        }
    }
}