<script setup>
import { onMounted, ref } from "vue"
import yhData from "./assets/yhlitemap_11.04.13.36.json"
let SVG = null;
onMounted(() => {
  SVG = document.getElementById("svgBox")
  console.log(SVG, yhData);
  yhData.segments.forEach((item, index) => {
    if(item.marking_list.length) {

    }
  })
})
const mouseDown = (e) => {
  console.log(e, 'e-');
  
}
</script>

<template>
  <div class="main_box">
    <svg  xmlns="http://www.w3.org/2000/svg" version="1.1" id="svgBox">
      <polyline points="50,50 100,150 150,100 200,200" fill="none" stroke="black" stroke-width="6" @mousedown="mouseDown" class="line_css"/>
    </svg>
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
</style>
