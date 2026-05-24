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

class Atom {
    constructor(x, y, z, type) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.type = type;
    }
}

class BioMT {
    constructor() {
        this.matrix = [ [ [1], [0], [0], [0] ], [ [0], [1], [0], [0] ], [ [0], [0], [1], [0] ] ];
    }
}

class BioMol {
    constructor() {
        this.chains = [];
        this.transf = [];
    }
}

class Model {
    constructor() {
        this.chains = {};
        // diff models in 1 file actually use the same biological assembly info, so unnecessary to store it here I think
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
    // https://files.rcsb.org/view/6VG7.pdb multiple models
    // https://files.rcsb.org/view/1K6F.pdb
    // https://files.rcsb.org/view/1GFL.pdb
    // https://files.rcsb.org/view/4Y2N.pdb other renderers only show 1 assembly, but this shows 2?
    // https://files.rcsb.org/view/1BPZ.pdb
    // https://files.rcsb.org/view/4TNA.pdb
    // https://files.rcsb.org/view/7U1T.pdb
    // 1C17
    // 3J7T
    // 3IZ2
    // 4RIL
    // 3B5U // this looks like the wrong length to me...
    // https://data.pdbj.org/pub/pdb/data/structures/obsolete/pdb/hh/pdb1hhb.ent // make names show correctly
    fetch('https://files.rcsb.org/view/1C17.pdb').then(res => {res.text().then(res => init(res));});
}

function init(pdb) {
    let title = '';
    let classification = '';
    let pdbID = '';
    let date = '';
    let authors = '';
    
    // get structure info
    let lines = pdb.split("\n");

    
    let bioAssemb = [];
    // contains list of BioMols
    // each BioMol contains .chains and .transf, a list of transformations
    // each transformation is a BioMT object, which has .matrix

    
    let models = [];
    
    
    let model = 0
    for (let line of lines) {
        if (line.slice(0, 4) == 'ATOM' || line.slice(0, 6) == 'HETATM') {
            if (models.length <= model) {
                let newModel = new Model([]);
                models.push(newModel);
            }
            
            let linesplit = line.trim().split(/\s+/);
            let coords = linesplit.slice(6, 9);
            let type = line.slice(76, 78).trim();
            let chain = line.slice(21, 22);
            let atom = new Atom(coords[0], coords[1], coords[2], type);
            if (!Object.hasOwn(models[model].chains, chain)) {
                models[model].chains[chain] = [];
            }
            models[model].chains[chain].push(atom);            
        } else if (line.slice(0, 5) == 'TITLE') {
            let text = line.slice(10, 80);
            title += text;
        } else if (line.slice(0, 6) == 'HEADER') {
            classification = line.slice(10, 50);
            date = line.slice(50, 59)
            pdbID = line.slice(62, 66);
        } else if (line.slice(0, 6) == 'ENDMDL') {
            model++;
        } else if (line.slice(0, 6) == 'AUTHOR') {
            authors += line.slice(10, 80);
        } else if (line.slice(0, 6) == 'REMARK') {
            if (line.slice(7, 10) == '350') {
                // biological assembly information
                if (line.slice(11, 23) == 'BIOMOLECULE:') {
                    // I'm going to assume they're not being created out of order... if that even matters
                    bioAssemb.push(new BioMol());
                    // new biomolecule
                } else if (line.slice(11, 41) == 'APPLY THE FOLLOWING TO CHAINS:') {
                    let newChains = [];
                    for (let i = 42; i < 80; i++) {
                        let current = line.slice(i, i+1);
                        if (current != ' ' && current != ',') {newChains.push(current);}
                    }
                    // new transformation being created
                    bioAssemb[bioAssemb.length-1].transf.push(new BioMT());
                    
                    bioAssemb[bioAssemb.length-1].chains = newChains;
                    
                } else if (line.slice(11, 41) == '                   AND CHAINS:') { // I think that works....
                    let newChains = []; 
                    for (let i = 42; i < 80; i++) {
                        let current = line.slice(i, i+1);
                        if (current != ' ' && current != ',') {newChains.push(current);}
                    }
                    // repeated code

                    bioAssemb[bioAssemb.length-1].chains.push(...newChains);
                    // extend list, rather than creating it
                } else if (line.slice(13, 18) == 'BIOMT') {
                    // 1 individual part of the transformation being created
                    
                    let transformation = line.slice(18, 19);
                    // the type of individual transformation on this line (x, y, z) presented as 1, 2, 3
                    
                    let num = line.slice(19, 23);
                    // the number of this transformation in the biomolecule

                    // I think this should allow transformations out of order, test this
                    while (bioAssemb[bioAssemb.length-1].transf.length < num) { 
                        bioAssemb[bioAssemb.length-1].transf.push(new BioMT());
                    }
                    // check if this is even needed though
                    
                    let el1 = parseFloat(line.slice(24, 34).trim());
                    let el2 = parseFloat(line.slice(34, 44).trim());
                    let el3 = parseFloat(line.slice(44, 54).trim());
                    let transl = parseFloat(line.slice(55, 65).trim());
                    bioAssemb[bioAssemb.length-1].transf[num-1].matrix[transformation-1] = [el1, el2, el3, transl];
                }
            }
        }
    }

    // this doesn't work yet, need to add a way to add all chains
    if (bioAssemb.length == 0) {
        let newBio = new BioMT();
        let newMol = new BioMol();
        newMol.transf.push(newBio)
        bioAssemb.push(newMol); // test this
    }

    let titleEl = document.querySelector('#title');
    let classificationEl = document.querySelector('#classification');
    let authorEl = document.querySelector('#author');
    let pdbEl = document.querySelector('#pdb');
    let dateEl = document.querySelector('#date');
    titleEl.textContent = title;
    classificationEl.textContent = classification;
    pdbEl.textContent = 'PDB ID: ' + pdbID;

    let year = date.slice(7, 9);
    let formattedDate = date.slice(3, 6) + " " + date.slice(0, 2) + ", " + (year > 71 ? "19" + year : "20" + year);
    dateEl.textContent = formattedDate;
    authorEl.textContent = authors.split('.').join('. ').split(',').join(', ');
    
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

    let currentMdl = 0;
    let modelEl = document.querySelector("#modelText");
    modelEl.textContent = "1/"+(models.length);

    function updateModel() {
        if (currentMdl >= models.length) {
            currentMdl = 0;
        }
        if (currentMdl < 0) {
            currentMdl = models.length - 1;
        }
        modelEl.textContent = (currentMdl + 1) + "/" + models.length; 
    }
    
    document.querySelector("#prev").addEventListener("click", () => {
        currentMdl--;
        updateModel();
    });
    document.querySelector("#next").addEventListener("click", () => {
        currentMdl++;
        updateModel();
    });
    let changeModel = false;
    let upload = false;
    document.querySelector("#linkForm").addEventListener("submit", (evt) => {
        evt.preventDefault();
        changeModel = true;
    });
    document.querySelector('#fileInput').addEventListener('change', (evt) => {
        changeModel = true;
        upload = true;
    });    

    requestAnimationFrame(tick);
    function tick() {
        renderCanvas(canvas);
        for (let i = 0; i < canvas.pixels.length; i++) {canvas.pixels[i] = 0;}

        canvas.depth = new Array(canvas.w * canvas.h).fill(Infinity); // inefficient?

        // all atoms not part of one of the chains of the biomolecule will not be rendered
        // check if this is correct, and if any files have this

        function rotationMatrix(matrix, x0, y0, z0) {
            let x = matrix[0][0]*x0+matrix[0][1]*y0+matrix[0][2]*z0+matrix[0][3];
            let y = matrix[1][0]*x0+matrix[1][1]*y0+matrix[1][2]*z0+matrix[1][3];
            let z = matrix[2][0]*x0+matrix[2][1]*y0+matrix[2][2]*z0+matrix[2][3];
            return {x: x, y: y, z: z};
        }

        let atomRenderedCount = 0;
        
        for (let biom of bioAssemb) {
            for (let chain of biom.chains) {
                for (let atom of models[currentMdl].chains[chain]) {
                    
                    let rgb = new RGB(247, 192, 196);
                    if (Object.hasOwn(colors, atom.type)) {
                        rgb = colors[atom.type];
                    } else {
                        console.log(atom.type);
                    }
                    atomRenderedCount++;
                    if (biom.transf.length < 1) {
                        atomRenderedCount--;
                    }
                    for (let transf of biom.transf) {
                        let coords = rotationMatrix(transf.matrix, atom.x, atom.y, atom.z);
                        sphere(canvas, cam, coords.x, coords.y, coords.z, 0.8, rgb);
                    }
                }
            }
        }
        
        i++;
        controls(pressedKeys, cam);
        
        if (changeModel) {
            if (upload) {
                const file = document.querySelector('#fileInput').files[0];

                const r = new FileReader()
                r.readAsText(file, 'UTF-8');
                r.onload = (evt) => {
                    let text = evt.target.result;
                    init(text);
                }
                
            } else {
                let newPdb = document.querySelector("#linkInput").value;
                if (newPdb.length == 4) {newPdb = `https://files.rcsb.org/view/${newPdb}.pdb`}
                fetch(newPdb).then(res => {
                    if (!res.ok) {throw new Error("Error loading pdb file - " + res.status)};
                    res.text().then(res => init(res));
                }).catch( error => {
                    console.log(error);
                    alert("Error loading file");
                    init(pdb);
                });
            }
        } else {
            requestAnimationFrame(tick);
        }   
    }
}