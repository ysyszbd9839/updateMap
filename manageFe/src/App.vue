<script setup>
import { onMounted, ref } from "vue";
import jsonData from "./assets/yhlitemap_11.04.13.36.json";
import roadData from "./assets/road.json";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { wgs2utm } from "./utils/utils.js";

let scene, camera, renderer, controls, raycaster;
const mouse = new THREE.Vector2();
let yhLines = new THREE.Group();
let yhCircles = new THREE.Group();
let yhRoad = new THREE.Group();
let origin_utm_x = 456788.630270388,
  origin_utm_y = 4426624.75945682;
let colors = {
  lanes: "red",
  marking_list: "blue",
  selectLine: "pink",
  selectCircle: "green",
};
let selectData = ref({
    data: {}, // 选中线原始数据
    lineObj: null, // 选中的线元素
    circleObj: null, // 选中的点元素
    info: {}, // 选中的线元素信息
    circleIndex: -1, // 选中的点元素下标
    lanes: new Map(), // lanes转换过的数组
    marking_list: new Map(), // marking_list转换过的数组
    movePoints: [], // 用来存放当前选定线条的数据
  }),
  yhData = jsonData,
  isDragging = ref(false),
  dialogVisible = ref(false);
let fileName = ref([]);

init();
animate();
onMounted(() => {});
function init() {
  // 初始化场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);

  // 相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.set(0, 0, 10);

  // 渲染器
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 0.01; // 设置最小缩放距离
  // 禁止围绕 X 和 Y 轴旋转
  controls.enableRotate = true; // 启用旋转
  controls.maxPolarAngle = Math.PI / 2; // 最大俯视角度为 90 度
  controls.minPolarAngle = Math.PI / 2; // 最小俯视角度为 90 度
  // 禁用左键旋转
  controls.mouseButtons = {
    LEFT: null, // 禁用左键功能
    RIGHT: THREE.MOUSE.PAN, // 右键拖动画布
    MIDDLE: THREE.MOUSE.DOLLY, // 滚轮缩放
  };

  // 保留平移和缩放
  controls.enablePan = true; // 启用平移（右键拖动）
  controls.enableZoom = true; // 启用缩放

  // 光源
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 0, 100);
  scene.add(light);

  // 添加坐标轴
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
  handleRoad();
  handleDate(yhData.segments);

  // 初始化 Raycaster
  raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  // raycaster.far = 1000; // 设置一个较大的检测距离
  raycaster.params.Line.threshold = 0.2; // 调整射线检测阈值

  // 事件监听
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("keydown", onKeyDown);
}
function onMouseDown(event) {
  event.preventDefault();
  if (event.button === 0) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.params.Points.threshold = 1.0; // 检测点的范围
    raycaster.setFromCamera(mouse, camera);
    // 检测交互
    const intersects = raycaster.intersectObjects([
      ...yhLines.children,
      ...yhCircles.children,
    ]);
    if (intersects.length > 0) {
      console.log("选中:", intersects[0], selectData.value);
      let info = intersects[0].object.userData.yhInfo;
      if (info.type === "line") {
        if (
          info.segmentId === selectData.value.info.segmentId &&
          info.lineType === selectData.value.info.lineType &&
          info.lineIndex === selectData.value.info.lineIndex
        )
          return;
        if (selectData.value.lineObj) {
          selectData.value.lineObj.material.color.setStyle(
            colors[selectData.value.info.lineType]
          );
        }
        selectData.value.lineObj = findLine(
          yhLines,
          `yh_${info.segIndex}_${info.lineType}_${info.lineIndex}`
        );
        selectData.value.info = info;
        selectData.value.data = findData(info);
        selectData.value.movePoints = selectData.value[info.lineType].get(
          info.segmentId
        )[info.lineIndex];
        console.log(selectData.value, "selectData.value===========");

        handleCircles(selectData.value.data);
        selectData.value.lineObj.material.color.setStyle(colors.selectLine);
      } else if (info.type === "circle") {
        if (selectData.value.circleObj) {
          selectData.value.circleObj.material.color.setStyle("red");
        }
        selectData.value.circleObj = findLine(
          yhCircles,
          `yh_circle_${info.pointIndex}`
        );
        isDragging.value = true;
        selectData.value.circleIndex = info.pointIndex;
        selectData.value.circleObj.material.color.setStyle(colors.selectCircle);
      }
    } else {
      if (selectData.value.lineObj) {
        selectData.value.lineObj.material.color.setStyle(
          colors[selectData.value.info.lineType]
        );
        initSelect();
      }
    }
  }
}
// 初始化选择数组
function initSelect() {
  clear(yhCircles);
  selectData.value.data = {};
  selectData.value.lineObj = null;
  selectData.value.circleObj = null;
  selectData.value.info = {};
  selectData.value.circleIndex = -1;
  selectData.value.movePoints = [];
}
function findLine(group, name) {
  return group.children.filter((ele) => {
    return ele.name === name;
  })[0];
}
function onMouseMove(event) {
  event.preventDefault();
  if (isDragging.value) {
    // 将鼠标坐标转换为世界坐标
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2); // z = 0 的平面
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    const selectedCircle = yhCircles.children[selectData.value.circleIndex];
    if (selectedCircle) {
      const attribute = selectedCircle.geometry.attributes.position;
      // 更新点的坐标（假设点的索引为 0）
      attribute.setXYZ(0, intersection.x, intersection.y, 0.2);
      attribute.needsUpdate = true;
      // 更新几何体的包围盒（确保射线检测正确）
      selectedCircle.geometry.computeBoundingBox();
      selectedCircle.geometry.computeBoundingSphere();
      let points = selectData.value.movePoints;

      points[selectData.value.circleIndex] = new THREE.Vector3(
        intersection.x,
        intersection.y,
        0.1
      );
      selectData.value.lineObj.geometry.setFromPoints(points);
      selectData.value.movePoints = points;
      selectData.value.lineObj.geometry.attributes.position.needsUpdate = true; // 通知更新
    } else {
      console.log(console.warn("未找到有效的圆对象"));
    }
    // 手动更新渲染
    renderer.render(scene, camera);
  }
}
function onMouseUp(event) {
  if (isDragging.value) {
    isDragging.value = false;
    let points = selectData.value[selectData.value.info.lineType].get(
      selectData.value.info.segmentId
    );
    points[selectData.value.info.lineIndex] = selectData.value.movePoints;
    selectData.value[selectData.value.info.lineType].set(
      selectData.value.info.segmentId,
      points
    );
    let point =
      points[selectData.value.info.lineIndex][selectData.value.circleIndex];

    selectData.value.data.points[
      selectData.value.circleIndex
    ] = `${point.x},${point.y}`;

    yhData.segments[selectData.value.info.segIndex][
      selectData.value.info.lineType
    ][selectData.value.info.lineIndex] = selectData.value.data;
    // handleDate(yhData.segments);
  }
}
function onKeyDown(event) {
  if (event.key === "Backspace" || event.key === "Delete") {
    if (!selectData.value.lineObj) return;
    dialogVisible.value = true;
  } else if (dialogVisible.value && (event.key === "p" || event.key === "P")) {
  } else if (dialogVisible.value && (event.key === "l" || event.key === "L")) {
    delLine();
  } else if (dialogVisible.value && (event.key === "r" || event.key === "R")) {
  }
}
function delPoint() {
  if (selectData.value.circleIndex === -1) return;
  let { info, data, lineObj, circleIndex, circleObj, movePoints } =
    selectData.value;

  movePoints.splice(circleIndex, 1);
  // yhData.segments[info.segIndex][info.lineType][info.lineIndex].points.splice(
  //   circleIndex,
  //   1
  // );
  let points = selectData.value[selectData.value.info.lineType].get(
    selectData.value.info.segmentId
  );
  points[info.lineIndex] = movePoints;
  selectData.value[selectData.value.info.lineType].set(
    selectData.value.info.segmentId,
    points
  );
  data.points.splice(circleIndex, 1);
  lineObj = findLine(
    yhLines,
    `yh_${info.segIndex}_${info.lineType}_${info.lineIndex}`
  );
  lineObj.geometry.dispose();
  lineObj.material.dispose();
  yhLines.remove(lineObj);
  scene.remove(lineObj);
  clear(yhCircles);
  circleObj = null;
  circleIndex = -1;
  console.log(selectData.value, "selectData.value");

  if (data.points.length) {
    drawLine(
      handleLineData(data.points),
      colors[info.lineType],
      info.segIndex,
      info.lineIndex,
      info.lineType,
      info.segmentId
    );
    lineObj = findLine(
      yhLines,
      `yh_${info.segIndex}_${info.lineType}_${info.lineIndex}`
    );
    selectData.value.lineObj = lineObj;
    handleCircles(data);
  }

  dialogVisible.value = false;
}
function delLine() {
  if (!selectData.value.lineObj) return;
  yhData.segments[selectData.value.info.segIndex][
    selectData.value.info.lineType
  ].splice(selectData.value.info.lineIndex, 1);
  let points = selectData.value[selectData.value.info.lineType].get(
    selectData.value.info.segmentId
  );
  let info = selectData.value.info;
  points.splice(selectData.value.info.lineIndex, 1);
  selectData.value[selectData.value.info.lineType].set(
    selectData.value.info.segmentId,
    points
  );

  let line = findLine(
    yhLines,
    `yh_${info.segIndex}_${info.lineType}_${info.lineIndex}`
  );

  line.geometry.dispose();
  line.material.dispose();
  yhLines.remove(line);
  scene.remove(line);
  initSelect();
  dialogVisible.value = false;
}
function delRoad() {}
function handleRoad() {
  roadData.features.forEach((item, index) => {
    let arr = [],
      arr_1 = [];
    item.geometry.coordinates.forEach((ele) => {
      let point = wgs2utm(ele[0], ele[1]);
      arr.push([point[0] - origin_utm_x, point[1] - origin_utm_y, 0.1]);
      arr_1.push([point[0] - origin_utm_x, point[1] - origin_utm_y, 0.3]);
    });
    // 创建 LineGeometry 和 LineMaterial
    const geometry = new LineGeometry();
    geometry.setPositions(arr.flat()); // 设置顶点数据
    const material = new LineMaterial({
      color: 0x4b41d8, // 线条颜色
      linewidth: 3.4, // 设置线宽，单位是像素
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight), // 用于调整线宽的渲染分辨率
    });
    geometry.setPositions(arr_1.flat()); // 设置顶点数据
    const material_1 = new LineMaterial({
      color: 0xffffff, // 线条颜色
      linewidth: 1, // 设置线宽，单位是像素
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight), // 用于调整线宽的渲染分辨率
    });

    // 创建线条对象
    const line = new Line2(geometry, material);
    const line_1 = new Line2(geometry, material_1);
    yhRoad.add(line);
    yhRoad.add(line_1);
    scene.add(yhRoad);
  });
}
function drawWLine() {}
function handleDate(segments) {
  segments.forEach((item, index) => {
    if (item.lanes.length) {
      item.lanes.forEach((e, i) => {
        if (e.points.length) {
          const arr = handleLineData(e.points);
          if (selectData.value.lanes.has(item.segmentId)) {
            const points = selectData.value.lanes.get(item.segmentId);
            points.push(arr);
            selectData.value.lanes.set(item.segmentId, points);
          } else {
            selectData.value.lanes.set(item.segmentId, [arr]);
          }
          drawLine(arr, colors["lanes"], index, i, "lanes", item.segmentId);
        }
      });
    }
    if (item.marking_list.length) {
      item.marking_list.forEach((e, i) => {
        if (e.points.length) {
          const arr = handleLineData(e.points);
          if (selectData.value.marking_list.has(item.segmentId)) {
            const points = selectData.value.marking_list.get(item.segmentId);
            points.push(arr);
            selectData.value.marking_list.set(item.segmentId, points);
          } else {
            selectData.value.marking_list.set(item.segmentId, [arr]);
          }
          drawLine(
            arr,
            colors["marking_list"],
            index,
            i,
            "marking_list",
            item.segmentId
          );
        }
      });
    }
  });
}
function handleLineData(points) {
  let arr = points.map((ele) => {
    let p = ele.split(",");
    return new THREE.Vector3(Number(p[0]), Number(p[1]), 0.1);
  });
  return arr;
}
// 绘制线条
function drawLine(points, color, segIndex, lineIndex, type, segmentId) {
  const material_main = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
  });
  const geometry_main = new THREE.BufferGeometry().setFromPoints(points);
  const line_main = new THREE.Line(geometry_main, material_main);
  line_main.name = `yh_${segIndex}_${type}_${lineIndex}`;
  line_main.userData.yhInfo = {
    segIndex: segIndex,
    lineIndex: lineIndex,
    lineType: type,
    segmentId: segmentId,
    type: "line",
  };

  yhLines.add(line_main);
  scene.add(yhLines);
}
function findData(info) {
  let data = yhData.segments[info.segIndex][info.lineType][info.lineIndex];
  if (yhData.segments[info.segIndex].segmentId == info.segmentId) {
    return data;
  } else {
    return null;
  }
}
function handleCircles(data) {
  if (yhCircles.children.length) {
    clear(yhCircles);
  }
  data.points.map((ele, index) => {
    let p = ele.split(",");
    drawCircle(new THREE.Vector3(Number(p[0]), Number(p[1]), 0.2), index);
  });
}
function clear(group) {
  group.children.forEach((child) => {
    child.geometry.dispose();
    child.material.dispose();
    group.remove(child);
    child = null;
  });
  group.clear();
}
function drawCircle(positions, index) {
  let geometry = new THREE.BufferGeometry().setFromPoints([positions]);
  // 创建点的材质
  const material = new THREE.PointsMaterial({
    color: 0xff0000, // 点的颜色
    size: 0.5, // 点的大小
    sizeAttenuation: true, // 根据距离缩放点大小
  });
  // 创建点
  const points = new THREE.Points(geometry, material);
  points.userData.yhInfo = {
    pointIndex: index,
    type: "circle",
  };
  points.name = `yh_circle_${index}`;
  yhCircles.add(points);

  scene.add(yhCircles);
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
// 上传文件
function uploadFile(event) {
  let file = event.target.files[0];
  console.log(file, "oooooooo");
  fileName.value = file.name;
  if (!file.name.includes("yh")) {
    ElMessage({
      message: "文件名中必须包含yh字样",
      type: "warning",
    });
  }
  if (file.type != "application/json" || !fileName.value.includes(".json")) {
    ElMessage({
      message: "只允许上传json文件",
      type: "warning",
    });
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    yhData = JSON.parse(reader.result);
    clearAll();
    origin_utm_x = yhData.origin_utm_x;
    origin_utm_y = yhData.origin_utm_y;
    handleDate(yhData.segments);
    handleRoad();
    console.log(yhData, "yhData");
  };
  reader.readAsText(file);
}
// 清除所有文件绘制的线条
function clearAll() {
  initSelect();
  clear(yhLines);
  clear(yhRoad);
  selectData.value.lanes.clear();
  selectData.value.marking_list.clear();
}
</script>

<template>
  <!-- <div ref="canvasContainer" class="main_box"></div> -->
  <div>
    <el-dialog v-model="dialogVisible" title="请选择你要删除的类型" width="500">
      <div class="dialog_text">
        <div class="text_point">删除点：</div>
        删除掉选定的那个点
        <el-button type="warning" @click="delPoint">删除点( P )</el-button>
      </div>
      <div class="dialog_text">
        <div class="text_line">删除线：</div>
        删除掉选定的那条线
        <el-button type="primary" @click="delLine"> 删除线 ( L ) </el-button>
      </div>
      <div class="dialog_text">
        <div class="text_road">删除整条道路：</div>
        删除掉选定线所在的道路<el-button type="danger" @click="delRoad">
          删除整条道路 ( R )
        </el-button>
      </div>
    </el-dialog>
    <div class="tools_box">
      <el-button type="primary" class="upload_btn"
        >选择 YH 文件
        <input
          ref="file"
          class="input_file"
          type="file"
          accept="application/json"
          title=""
          @change="uploadFile"
        />
      </el-button>
      <el-button type="success" class="save_btn">保存文件</el-button>
    </div>
  </div>
</template>

<style scoped>
.main_box {
  width: 100vw;
  height: 100vh;
}
.line_css {
  cursor: pointer;
}
.yh_dialog_footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text_line {
  color: #409eff;
}
.text_point {
  color: #e6a23c;
}
.text_road {
  color: #f56c6c;
}
.dialog_text {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
}
.tools_box {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.upload_btn {
  position: relative;
  margin-bottom: 6px;
}
.input_file {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #409eff;
  opacity: 0;
}
.save_btn {
  margin-left: 0 !important;
}
</style>
