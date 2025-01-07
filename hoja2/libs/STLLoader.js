// STLLoader.js

(function () {
    class STLLoader extends THREE.Loader {
        constructor(manager) {
            super(manager);
        }

        load(url, onLoad, onProgress, onError) {
            const scope = this;
            const loader = new THREE.FileLoader(this.manager);
            loader.setPath(this.path);
            loader.setResponseType('arraybuffer');
            loader.setRequestHeader(this.requestHeader);
            loader.setWithCredentials(this.withCredentials);

            loader.load(url, function (text) {
                try {
                    onLoad(scope.parse(text));
                } catch (e) {
                    if (onError) {
                        onError(e);
                    } else {
                        console.error(e);
                    }
                    scope.manager.itemError(url);
                }
            }, onProgress, onError);
        }

        parse(data) {
            function isBinary(data) {
                const reader = new DataView(data);
                const face_size = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
                const n_faces = reader.getUint32(80, true);
                const expect = 80 + (32 / 8) + (n_faces * face_size);

                if (expect === reader.byteLength) {
                    return true;
                }

                const solid = [115, 111, 108, 105, 100];
                for (let off = 0; off < 5; off++) {
                    if (matchDataViewAt(solid, reader, off)) return false;
                }

                return true;
            }

            function matchDataViewAt(query, reader, offset) {
                for (let i = 0, il = query.length; i < il; i++) {
                    if (query[i] !== reader.getUint8(offset + i)) return false;
                }
                return true;
            }

            function parseBinary(data) {
                const reader = new DataView(data);
                const faces = reader.getUint32(80, true);

                let r, g, b, hasColors = false, colors;
                let defaultR, defaultG, defaultB, alpha;

                for (let index = 0; index < 80 - 10; index++) {
                    if ((reader.getUint32(index, false) == 0x434F4C4F /*COLO*/) &&
                        (reader.getUint8(index + 4) == 0x52 /*'R'*/) &&
                        (reader.getUint8(index + 5) == 0x3D /*'='*/)) {

                        hasColors = true;
                        colors = new Float32Array(faces * 3 * 3);

                        defaultR = reader.getUint8(index + 6) / 255;
                        defaultG = reader.getUint8(index + 7) / 255;
                        defaultB = reader.getUint8(index + 8) / 255;
                        alpha = reader.getUint8(index + 9) / 255;
                    }
                }

                const dataOffset = 84;
                const faceLength = 12 * 4 + 2;

                const geometry = new THREE.BufferGeometry();
                const vertices = new Float32Array(faces * 3 * 3);
                const normals = new Float32Array(faces * 3 * 3);

                for (let face = 0; face < faces; face++) {
                    const start = dataOffset + face * faceLength;
                    const normalX = reader.getFloat32(start, true);
                    const normalY = reader.getFloat32(start + 4, true);
                    const normalZ = reader.getFloat32(start + 8, true);

                    if (hasColors) {
                        const packedColor = reader.getUint16(start + 48, true);

                        if ((packedColor & 0x8000) === 0) {
                            r = (packedColor & 0x1F) / 31;
                            g = ((packedColor >> 5) & 0x1F) / 31;
                            b = ((packedColor >> 10) & 0x1F) / 31;
                        } else {
                            r = defaultR;
                            g = defaultG;
                            b = defaultB;
                        }
                    }

                    for (let i = 1; i <= 3; i++) {
                        const vertexstart = start + i * 12;
                        const componentIdx = (face * 3 * 3) + ((i - 1) * 3);

                        vertices[componentIdx] = reader.getFloat32(vertexstart, true);
                        vertices[componentIdx + 1] = reader.getFloat32(vertexstart + 4, true);
                        vertices[componentIdx + 2] = reader.getFloat32(vertexstart + 8, true);

                        normals[componentIdx] = normalX;
                        normals[componentIdx + 1] = normalY;
                        normals[componentIdx + 2] = normalZ;

                        if (hasColors) {
                            colors[componentIdx] = r;
                            colors[componentIdx + 1] = g;
                            colors[componentIdx + 2] = b;
                        }
                    }
                }

                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

                if (hasColors) {
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    geometry.hasColors = true;
                    geometry.alpha = alpha;
                }

                return geometry;
            }

            function parseASCII(data) {
                const geometry = new THREE.BufferGeometry();
                const patternSolid = /solid([\s\S]*?)endsolid/g;
                const patternFace = /facet([\s\S]*?)endfacet/g;
                let faceCounter = 0;

                const patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

                const vertices = [];
                const normals = [];

                let result;

                while ((result = patternSolid.exec(data)) !== null) {
                    const text = result[0];

                    while ((result = patternFace.exec(text)) !== null) {
                        let vertexCountPerFace = 0;
                        let normalX = 0;
                        let normalY = 0;
                        let normalZ = 0;

                        const text = result[0];

                        while ((result = patternFloat.exec(text)) !== null) {
                            switch (vertexCountPerFace) {
                                case 0:
                                    normalX = parseFloat(result[1]);
                                    break;
                                case 1:
                                    normalY = parseFloat(result[1]);
                                    break;
                                case 2:
                                    normalZ = parseFloat(result[1]);
                                    break;
                                case 3:
                                    vertices.push(parseFloat(result[1]));
                                    break;
                                case 4:
                                    vertices.push(parseFloat(result[1]));
                                    break;
                                case 5:
                                    vertices.push(parseFloat(result[1]));
                                    vertexCountPerFace = -1;
                                    faceCounter++;
                                    break;
                            }
                            vertexCountPerFace++;
                        }

                        if (normalX !== 0 || normalY !== 0 || normalZ !== 0) {
                            const normal = new THREE.Vector3(normalX, normalY, normalZ);
                            normal.normalize();

                            for (let i = 0; i < 3; i++) {
                                normals.push(normal.x, normal.y, normal.z);
                            }
                        } else {
                            const cb = new THREE.Vector3();
                            const ab = new THREE.Vector3();

                            const vA = new THREE.Vector3(
                                vertices[vertices.length - 9],
                                vertices[vertices.length - 8],
                                vertices[vertices.length - 7]
                            );
                            const vB = new THREE.Vector3(
                                vertices[vertices.length - 6],
                                vertices[vertices.length - 5],
                                vertices[vertices.length - 4]
                            );
                            const vC = new THREE.Vector3(
                                vertices[vertices.length - 3],
                                vertices[vertices.length - 2],
                                vertices[vertices.length - 1]
                            );

                            cb.subVectors(vC, vB);
                            ab.subVectors(vA, vB);
                            cb.cross(ab).normalize();

                            normals.push(cb.x, cb.y, cb.z);
                            normals.push(cb.x, cb.y, cb.z);
                            normals.push(cb.x, cb.y, cb.z);
                        }
                    }
                }

                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

                return geometry;
            }

            function ensureString(buffer) {
                if (typeof buffer !== 'string') {
                    return new TextDecoder().decode(new Uint8Array(buffer));
                }
                return buffer;
            }

            function ensureBinary(buffer) {
                if (typeof buffer === 'string') {
                    const array_buffer = new Uint8Array(buffer.length);
                    for (let i = 0; i < buffer.length; i++) {
                        array_buffer[i] = buffer.charCodeAt(i) & 0xff;
                    }
                    return array_buffer.buffer || array_buffer;
                }
                return buffer;
            }

            const binData = ensureBinary(data);
            return isBinary(binData) ? parseBinary(binData) : parseASCII(ensureString(data));
        }
    }

    THREE.STLLoader = STLLoader;
})();