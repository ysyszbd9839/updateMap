import * as THREE from "./utils/three.module.js";

let renderer, scene, camera, controls;
console.log(window, "window");

function getData() {
  fetch("/yhlitemap_1017.json")
    .then((res) => {
      return res.json();
    })
    .then((data) => {
      handleData(data.segments);
    });
}
function handleData(data) {
  data.forEach((item, index) => {
    if (item.marking_list.length) {
      item.marking_list.forEach((ele, i) => {
        let arr = ele.points.map((e) => {
          const point = e.split(",");
          return new THREE.Vector3(point[0], point[1], 0);
        });
        drawLine(arr);
      });
    }
  });
}
function drawLine(data) {
  // console.log(data, "data");
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
  const geometry = new THREE.BufferGeometry().setFromPoints(data);
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}

// 初始化场景
function initThree() {
  // 基本场景设置
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 5); // 设置相机位置 (x: 0, y: 0, z: 5)
  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  // 添加灯光
  let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(directionalLight);
  scene.add(ambientLight);

  // 添加一个立方体
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);

  scene.add(cube);
  console.log(THREE, "THREE");

  // 创建 OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  scene.add(controls);
  // 设置相机位置
  camera.position.z = 5;
}
// 动画循环
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // 更新控制器
  renderer.render(scene, camera);
}
initThree();
animate();
getData();
