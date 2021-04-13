class MVVM {
  constructor (options) {
    this.$options = options
    this.$data = options.data
    this.$methods = options.methods
    this.$el = document.querySelector(options.el)

    if (this.$el) {
      new Observer(this.$data)
      this.proxyData(this.$data)
      new Compiler(this, this.$el)
    }
  }

  proxyData (data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get () {
          return data[key]
        },
        set (newVal) {
          data[key] = newVal
        }
      })
    }
  }
}

class Observer {
  constructor (data) {
    this.observe(data)
  }

  observe (data) {
    if (typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }

  defineReactive (data, key, value) {
    this.observe(data[key])
    const dep = new Dep()
    // TODO: 重写数组的7种方法
    Object.defineProperty(data, key, {
      enumerable: true,
      configurable: true,
      get: () => {
        Dep.target && dep.append(Dep.target)
        return value
      },
      set: newVal => {
        value = newVal
        if (typeof newVal === 'object') {
          this.defineReactive(data, key, newVal)
        }
        dep.notify()
      }
    })
  }
}

class Dep {
  constructor () {
    this.subs = []
  }

  append (watcher) {
    this.subs.push(watcher)
  }

  notify () {
    this.subs.forEach(watcher => watcher.update())
  }
}

class Watcher {
  constructor (vm, expression, callback) {
    this.vm = vm
    this.expression = expression
    this.callback = callback

    Dep.target = this
    this.oldValue = CompileUtil.getValue(vm, expression)
    Dep.target = null
  }

  update () {
    const newValue = CompileUtil.getValue(vm, this.expression)
    if (newValue !== this.oldValue) {
      this.callback(newValue)
      this.oldValue = newValue
    }
  }
}

class Compiler {
  constructor (vm, el) {
    this.vm = vm
    this.el = el

    this.compile(this.el)
  }

  isDirective (attr) {
    return attr.startsWith('v-')
  }

  isElementNode (node) {
    return node.nodeType === 1
  }

  compileElement (node) {
    [...node.attributes].forEach(attr => {
      const { name, value } = attr
      if (this.isDirective(name)) {
        const [,directive] = name.split('-') // text | bind | html | on:click
        const [method, type] = directive.split(':')
        // TODO: v-if v-show
        CompileUtil[method](this.vm, node, value, type)

        node.removeAttribute(name)
      }
    })
  }

  compileText (node) {
    if (/{{(.+?)}}/.test(node.textContent)) {
      CompileUtil.text(this.vm, node, node.textContent)
    }
  }

  compile (el) {
    // TODO: 虚拟DOM、diff、文档碎片、异步渲染、nextTick
    el.childNodes.forEach(node => {
      // TODO: 组件类型编译
      if (this.isElementNode(node)) {
        // 编译元素节点
        this.compileElement(node)
      } else {
        // 编译文本节点
        this.compileText(node)
      }
      if (node.childNodes && node.childNodes.length) {
        this.compile(node)
      }
    })
  }
}

const CompileUtil = {
  getValue (vm, expression) {
    return expression.split('.').reduce((data, key) => {
      return data[key]
    }, vm.$data)
  },

  setValue (vm, expression, value) {
    return expression.split('.').reduce((data, key, index, arr) => {
      if (index === arr.length - 1) {
        data[key] = value
      }
      return data[key]
    }, vm.$data)
  },

  getContentValue (vm, expression) {
    return expression.replace(/{{(.+?)}}/g, (...args) => {
      return this.getValue(vm, args[1])
    })
  },

  text (vm, node, expression) {
    let value
    if (/{{(.+?)}}/.test(expression)) {
      value = expression.replace(/{{(.+?)}}/g, (...args) => {
        new Watcher(vm, args[1], newVal => {
          const contentVal = this.getContentValue(vm, expression)
          Updater.text(node, contentVal)
        })
        const value = this.getValue(vm, args[1])
        return value
      })
    } else {
      new Watcher(vm, expression, newVal => {
        Updater.text(node, newVal)
      })
      value = this.getValue(vm, expression)
    }
    Updater.text(node, value)
  },

  bind (vm, node, expression, attr) {
    const value = this.getValue(vm, expression)
    new Watcher(vm, expression, newVal => {
      Updater.bind(node, attr, newVal)
    })
    Updater.bind(node, attr, value)
  },

  html (vm, node, expression) {
    const value = this.getValue(vm, expression)
    new Watcher(vm, expression, newVal => {
      Updater.html(node, newVal)
    })
    Updater.html(node, value)
  },

  model (vm, node, expression) {
    const value = this.getValue(vm, expression)
    new Watcher(vm, expression, newVal => {
      Updater.model(node, newVal)
    })
    Updater.model(node, value)

    node.addEventListener('input', evt => {
      this.setValue(vm, expression, evt.target.value)
    })
  },

  on (vm, node, expression, type) {
    if (vm.$methods && vm.$methods[expression]) {
      let fn = vm.$methods[expression]
      node.addEventListener(type, fn.bind(vm))
    }
  }
}

const Updater = {
  text (node, value) {
    node.textContent = value
  },

  bind (node, name, value) {
    node.setAttribute(name, value)
  },

  html (node, value) {
    node.innerHTML = value
  },

  model (node, value) {
    node.value = value
  }
}
