<template>
  <teleport to="body">
    <div v-show="editDown.visible" ref="editorRef" class="dms-cell-editor" :style="editorStyle"
      @keydown.enter="handleSaveEditorValue" @keydown.esc="handleCloseEditor" @click.stop>
      <!-- 输入框编辑器 -->
      <el-input v-if="editDown.editType === 'input'" ref="inputRef" v-model="editValue" @change="handleSaveEditorValue"
        @keydown.stop />

      <!-- 下拉选择编辑器 -->
      <el-select v-else-if="editDown.editType === 'select'" ref="selectRef" v-model="editValue"
        @change="handleSaveEditorValue" @keydown.stop>
        <el-option v-for="option in editDown.editOptions" :key="option.value" :label="option.label"
          :value="option.value" />
      </el-select>

      <!-- 日期编辑器 -->
      <el-date-picker v-else-if="editDown.editType === 'date'" ref="dateRef" v-model="editValue" type="date"
        format="YYYY-MM-DD" value-format="YYYY-MM-DD" @blur="handleSaveEditorValue" @keydown.stop />

      <!-- 日期时间编辑器 -->
      <el-date-picker v-else-if="editDown.editType === 'datetime'" ref="datetimeRef" v-model="editValue" type="datetime"
        format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" @blur="handleSaveEditorValue" @keydown.stop />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { ElDatePicker, ElInput, ElOption, ElSelect } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

interface EditDown {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  editType: 'input' | 'select' | 'date' | 'datetime'
  editOptions?: EditOptions[]
  initialValue: string | number
  originalClientX: number
  originalClientY: number
}

interface EditOptions {
  label: string
  value: string | number
}



const editorRef = ref<HTMLElement>()
const inputRef = ref<InstanceType<typeof ElInput>>()
const selectRef = ref<InstanceType<typeof ElSelect>>()
const dateRef = ref<InstanceType<typeof ElDatePicker>>()
const datetimeRef = ref<InstanceType<typeof ElDatePicker>>()

const editValue = ref<string | number>('')

const editDown = reactive<EditDown>({
  visible: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  editType: 'input',
  initialValue: '',
  originalClientX: 0,
  originalClientY: 0
})

// 计算编辑器样式
const editorStyle = computed(() => {
  return {
    position: 'fixed' as const,
    left: `${editDown.x + 1}px`,
    top: `${editDown.y + 1}px`,
    width: `${editDown.width - 3}px`,
    height: `${editDown.height - 2}px`,
    zIndex: 999999,

    background: '#fff',
    padding: 0,
    margin: 0,
    boxSizing: 'border-box' as const,
    overflow: 'hidden'
  }
})

const openEditDropdown = (
  evt: KonvaEventObject<MouseEvent, Konva.Shape>,
  editType: 'input' | 'select' | 'date' | 'datetime',
  initialValue: string | number,
  editOptions?: EditOptions[]
) => {
  const { clientX, clientY } = evt.evt
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  const scrollY = window.pageYOffset || document.documentElement.scrollTop
  editDown.originalClientX = clientX + scrollX
  editDown.originalClientY = clientY + scrollY
  editDown.editType = editType
  editDown.editOptions = editOptions
  editDown.initialValue = initialValue
  editValue.value = initialValue
  editDown.visible = true
}


// 聚焦编辑器
const focusEditor = () => {
  nextTick(() => {
    switch (editDown.editType) {
      case 'input':
        inputRef.value?.focus()
        break
      case 'select':
        break
      case 'date':
        break
      case 'datetime':
        break
    }
  })
}

// 保存编辑
const handleSaveEditorValue = () => {
  // 只有当值发生变化时才保存
  if (editValue.value !== editDown.initialValue) {
    editDown.visible = false
  } else {
    editDown.visible = false
  }
}

// 取消编辑
const handleCloseEditor = () => {
  editDown.visible = false
}

// 点击外部关闭编辑器
const handleClickOutside = (e: MouseEvent) => {
  if (editDown.visible && editorRef.value && !editorRef.value.contains(e.target as Node)) {
    // 检查是否点击了 Element Plus 的下拉面板
    const target = e.target as HTMLElement
    const isElSelectDropdown = target.closest('.el-select-dropdown, .el-popper, .el-picker-panel')
    if (!isElSelectDropdown) {
      // 点击外部时保存数据而不是取消
      handleSaveEditorValue()
    }
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside, true)
})

defineExpose({
  openEditDropdown
})
</script>

<style lang="scss" scoped>
.dms-cell-editor {

  // 输入框样式
  :deep(.el-input) {
    height: 100%;

    .el-input__wrapper {
      height: 100%;
      border: none;
      box-shadow: none;
      background: transparent;
      border-radius: 0;
      padding: 0 8px;
      line-height: 1;
      display: flex;
      align-items: center;

      &:hover,
      &:focus,
      &.is-focus {
        border: none !important;
        box-shadow: none !important;
      }
    }

    .el-input__inner {
      height: 100%;
      border: none;
      padding: 0;
      font-size: 14px;
      line-height: 1;

      &:hover,
      &:focus {
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
    }
  }

  // 下拉选择样式
  :deep(.el-select) {
    height: 100%;
    width: 100%;

    .el-select__wrapper {
      // border: none !important;
      box-shadow: none !important;
      padding-top: 0;
      padding-bottom: 0;
      border-radius: 0;
    }
  }

  // 日期选择器样式
  :deep(.el-date-editor) {
    height: 100%;
    width: 100%;

    .el-input__wrapper {
      height: 100%;
      border: none;
      box-shadow: none;
      background: transparent;
      border-radius: 0;
      padding: 0 8px;
      line-height: 1;
      display: flex;
      align-items: center;

      &:hover,
      &:focus,
      &.is-focus {
        border: none !important;
        box-shadow: none !important;
      }
    }

    .el-input__inner {
      height: 100%;
      border: none;
      padding: 0;
      font-size: 14px;
      line-height: 1;

      &:hover,
      &:focus {
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
    }

    .el-input__prefix,
    .el-input__suffix {
      display: flex;
      align-items: center;
    }
  }
}
</style>
