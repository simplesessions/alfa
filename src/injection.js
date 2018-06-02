import isobject from 'isobject'
import PropTypes from 'prop-types'
import { Component, createElement } from 'react'

/**
 * Public API
 */

export const provide = createInjector('provide', createAlfaProvidedComponent)
export const subscribe = createInjector(
  'subscribe',
  createAlfaSubscribedComponent
)

/**
 * Private functions
 */

function createInjector(type, creator) {
  const wrapper = {
    [type]: function(WrappedComponent, inputs, outputs) {
      /* istanbul ignore next */
      const typeofComponent = typeof WrappedComponent
      if (typeofComponent === 'function') {
        const componentName = WrappedComponent.name
        inputs = normalizeInputs(componentName, inputs, WrappedComponent.keys)
        outputs = normalizeOutputs(componentName, inputs, outputs)
        return creator(
          WrappedComponent,
          inputs,
          outputs,
          WrappedComponent.prototype &&
            WrappedComponent.prototype.isReactComponent &&
            'component'
        )
      } else {
        throw new TypeError(
          `alfa.${type} only accepts function or class.
          Got "${typeofComponent}".`
        )
      }
    }
  }

  return wrapper[type]
}

export function normalizeInputs(name, inputs, dynamicInputs) {
  if (
    inputs &&
    ('string' === typeof inputs ||
      (isobject(inputs) &&
        /* istanbul ignore next */
        typeof inputs.alfaAction === 'function'))
  ) {
    return [inputs]
  } else if (Array.isArray(inputs)) {
    return inputs
  } else if ('function' === typeof dynamicInputs) {
    return []
  } else {
    throw new TypeError(`${name}: provide/subscribe only accepts string or array
     of strings as second parameter (inputs) when static property 'keys' of 
     component does not exist.`)
  }
}

export function normalizeOutputs(name, inputs, outputs) {
  // Check if output keys are provided when `set` is required as input key.
  if (
    Array.isArray(inputs) &&
    inputs.indexOf('set') > -1 &&
    (!Array.isArray(outputs) || 0 === outputs.length)
  ) {
    throw new Error(
      `${name}: outputs are required as 3rd argument of function 
"provide/subscribe" when "set" is provided/subscribed.`
    )
  }

  if (outputs) {
    // When we have key(s) of output we need to check the type(s) of all the keys.
    if ('string' === typeof outputs) {
      // The outputs is a string then normalize it as an array.
      return [outputs]
    }

    if (
      Array.isArray(outputs) &&
      outputs.every(key => typeof key === 'string')
    ) {
      // Outputs is an array, make sure all the elements of this array are string.
      return outputs
    }

    // Throw exception if any key of the outputs is not supported.
    throw new TypeError(`${name}: provide/subscribe only accepts string or array
     of strings as 3rd parameter (outputs).`)
  }
}

function createAlfaProvidedComponent(WrappedComponent, inputs, outputs, type) {
  // Keep the name of the orginal component which makes debugging logs easier
  // to understand.
  var componentName = WrappedComponent.name || 'AlfaProvidedComponent'

  var wrapper = {
    [componentName]: function(props, context, updater) {
      const injectedProps = getInjectedProps(inputs, outputs, context.alfaStore)
      // Props passed in directly to constructor has lower priority than inputs
      // injected from the store.
      var _props = {
        ...props,
        ...injectedProps
      }

      const dynamicProps = getDynamicProps(
        WrappedComponent.keys,
        _props,
        outputs,
        context && context.alfaStore
      )

      // Dynamic props have higher priority than static props.
      if (dynamicProps) {
        _props = {
          ..._props,
          ...dynamicProps.props
        }
      }

      if ('component' === type) {
        // Create an element if it's react component.
        return createElement(WrappedComponent, _props)
      } else {
        // Otherwise, call the original function.
        return WrappedComponent(_props, context, updater)
      }
    }
  }

  wrapper[componentName].contextTypes = {
    alfaStore: PropTypes.object
  }

  if (WrappedComponent.keys) {
    wrapper[componentName].keys = WrappedComponent.keys
  }

  return wrapper[componentName]
}

function createAlfaSubscribedComponent(WrappedComponent, inputs, outputs) {
  var classHolder = {
    // Keep the name of the orginal component which makes debugging logs easier
    // to understand.
    [WrappedComponent.name]: class AlfaSubscribedComponent extends Component {
      static contextTypes = {
        alfaStore: PropTypes.object
      }

      constructor(props, context, updater) {
        // Call the original constructor.
        super(props, context, updater)
        /* istanbul ignore next */
        const contextStore = context && context.alfaStore

        // Get injected props which eventually will become state of the component.
        const injectedProps = getInjectedProps(inputs, outputs, contextStore)
        // Merge injected props with props where the first one has higher priority.
        const _props = {
          ...props,
          ...injectedProps
        }

        // Get dynamic props.
        const dynamicProps = getDynamicProps(
          WrappedComponent.keys,
          _props,
          outputs,
          contextStore
        )

        // var maps
        if (dynamicProps) {
          this.subKeys = [...inputs, ...dynamicProps.inputs]
          this.subMaps = dynamicProps.maps
          this.state = {
            ..._props,
            ...dynamicProps.props
          }
        } else {
          this.subKeys = inputs
          this.state = _props
        }

        // Save the store for subscribe/unsubscribe.
        this.store = contextStore
        this.subFunc = this.setState.bind(this)
      }

      componentDidMount() {
        // Call `setState` when subscribed keys changed.
        this.store.subscribe(this.subKeys, this.subFunc, this.subMaps)
      }

      componentWillUnmount() {
        'function' === typeof this.subFunc &&
          this.store.unsubscribe(this.subFunc)
      }

      render() {
        return createElement(WrappedComponent, this.state)
      }
    }
  }

  if (WrappedComponent.keys) {
    classHolder[WrappedComponent.name].keys = WrappedComponent.keys
  }

  return classHolder[WrappedComponent.name]
}

function getInjectedProps(inputs, outputs, contextStore) {
  const stringInputs = inputs.filter(input => typeof input === 'string')
  const injectedProps = {
    ...contextStore.get(stringInputs)
  }

  inputs.forEach(input => {
    if (
      isobject(input) &&
      /* istanbul ignore next */
      typeof input.alfaAction === 'function'
    ) {
      // Generate the final action function which can be called inside the
      // component.
      injectedProps[input.name] = input.alfaAction(contextStore)
    }
  })

  // Need to inject set.
  if (inputs.indexOf('set') > -1) {
    injectedProps.set = contextStore.setWithOutputs(outputs)
  }

  return injectedProps
}

/**
 * Load dependencies with the result of calling `keys` function of the component.
 *
 * This gives people the ability to load dynamic dependencies based on the props
 * of the component at runtime.
 * It makes a map between the dynamic names of the dependencies and the names
 * of the properties injected in `state` of the component.
 * That helps maintaining a simple naming system in the application code.
 *
 * @param  {Function} keys
 * @param  {Object} props
 * @param  {Array} outputs
 * @param  {Object} contextStore
 * @return {Object}
 */
function getDynamicProps(keys, props, outputs, contextStore) {
  var result

  if (keys && 'function' === typeof keys) {
    const _keys = keys(props)
    if (Array.isArray(_keys)) {
      // Array of input keys.  There's no mapping in this case.  Item in the
      // array is the name of the input key.  We use this array to get
      // dependencies directly from the store.
      result = {
        inputs: _keys,
        props: getInjectedProps(_keys, outputs, contextStore)
      }
    } else if (isobject(_keys)) {
      // Object of mappings between injection keys and real input keys.
      const injectionKeys = Object.keys(_keys)
      const realInputs = injectionKeys.map(function(key) {
        return _keys[key]
      })
      const _props = getInjectedProps(realInputs, outputs, contextStore)
      const mappedProps = {}

      injectionKeys.forEach(function(key) {
        const realKey = _keys[key]
        mappedProps[key] = _props[realKey]
      })

      // Map outputs
      if (outputs && 'function' === typeof props.set) {
        // The `set` of `props` which is obtained from calling
        // `contextStore.setWithOutputs(outputs)`
        const _setWithOutputs = props.set
        // Call `_setWithOutputs` with maps if
        props.set = function(key, value) {
          _setWithOutputs(key, value, _keys)
        }
      }

      result = {
        maps: _keys,
        props: mappedProps,
        inputs: realInputs
      }
    }
  }

  return result
}
