<script setup>
import HelloWorld from "./components/HelloWorld.vue";
</script>

<template>
  <div>
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="svg">
      <line
        x1="0"
        y1="0"
        x2="200"
        y2="200"
        style="stroke: rgb(255, 0, 0); stroke-width: 2"
      />
    </svg>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
