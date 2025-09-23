<template>
  <div id="table-container" class="table-container"></div>
</template>
<script lang="ts" setup>
import { chartProps } from './chart-props';
import { onMounted } from 'vue';
const props = defineProps(chartProps);
onMounted(() => {
  console.log(props);

})
</script>