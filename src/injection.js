import PropTypes from 'prop-types'
import { Component, createElement } from 'react'

/**
 * Public API
 */

export function createProvide(store) {
  return function provide(WrappedComponent, keys) {
    if ('function' === typeof WrappedComponent)
      return createAlfaProvidedComponent(store, WrappedComponent, keys,
        isReactComponent(WrappedComponent) && 'component')
    else
      throw new Error('alfa.provide only accepts function or class.')
  }
}

export function createSubscribe(store) {
  return function subscribe(WrappedComponent, keys) {
    if ('function' === typeof WrappedComponent)
      return createAlfaSubscribedComponent(store, WrappedComponent, keys)
    else
      throw new Error('alfa.subscribe only accepts function or class.')
  }
}


/**
 * Private functions
 */


function isReactComponent(Component) {
  return Component.prototype && Component.prototype.isReactComponent
}


function createAlfaProvidedComponent(store, WrappedComponent, keys, type) {
  // Keep the name of the orginal component which makes debugging logs easier
  // to understand.
  var componentName = WrappedComponent.name || 'AlfaProvidedComponent'

  // Solution 1
  var wrapper = {
    [componentName]: function(props, context, updater) {
      // See if we have an alternative alfa store to use.
      store = context && context.alfaStore ? context.alfaStore : store
      // Props passed in directly to constructor has higher priority than keys
      // injected from the store.
      props = {
        ...store.get(keys),
        ...props || {}
      }

      if ('component' === type)
        // Create an element if it's react component.
        return createElement(WrappedComponent, props)
      else
        // Otherwise, call the original function.
        return WrappedFunction(props, context, updater)
    }
  }

  wrapper[componentName].contextTypes = {
    alfaStore: PropTypes.object
  }

  return wrapper[componentName]
}


function createAlfaSubscribedComponent(store, WrappedComponent, keys) {
  var subFunc

  class AlfaSubscribedComponent extends Component {
    // Keep the name of the orginal component which makes debugging logs easier
    // to understand.
    static get name() {
      return WrappedComponent.name
    }

    static contextTypes = {
      alfaStore: PropTypes.object
    }

    constructor(props, context, updater) {
      // Call the original constructor.
      super(props, context, updater)
      // See if we have an alternative alfa store to use.
      store = context && context.alfaStore ? context.alfaStore : store

      // Inject all keys as state.
      this.state = store.get(keys)

      // Call `setState` when subscribed keys changed.
      if ('function' === typeof this.setState) {
        // Make sure we use the correct store for unsubscribe.
        this.store = store
        subFunc = this.setState.bind(this)
        store.subscribe(keys, subFunc)
      }
    }

    componentWillUnmount() {
      'function' === typeof subFunc && this.store.unsubscribe(subFunc)
    }

    render() {
      // State injected may change during normal component lifecycle.
      // So in this case it has higher priority than props.
      var _props = {
        ...this.props || {},
        ...this.state
      }

      // State and props are merged and passed to wrapped component as props.
      return createElement(WrappedComponent, _props)
    }
  }

  return AlfaSubscribedComponent
}
