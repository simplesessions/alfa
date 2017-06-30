

/**
 * Create a key value store with simple subscription support.
 * 
 * @return {Store}
 */
export default function createStore() {
  /**
   * Internal object which holds the key/value map.
   * @type {Object}
   */
  const _store = {}

  /**
   * Internal object which holds all the subscription functions.
   * @type {Object}
   */
  const _subscriptions = {}

  /**
   * The Store class.
   */
  class Store {

    /**
     * Get value from store by key.
     * 
     * @param  {String} key Name of the value to get.
     * @return {Any}        Value.
     */
    get(key) {
      const keyType = typeof key

      if ('string' === keyType) {
        return _store[key]
      } else if (Array.isArray(key) && key.length > 0) {
        const results = {}
        key.forEach(function(k) {
          results[k] = _store[k]
        })
        return results
      }
    }

    /**
     * Save the `value` in store with name `key`.
     * 
     * @param {String}  key   Name of the value in store.
     * @param {Any}     value Value to save.
     */
    set(key, value) {
      if ('string' !== typeof key)
        throw new Error('Type of `key` must be string.')

      _store[key] = value

      // Call subscribed functions if we have.
      const subs = _subscriptions[key]
      if (Array.isArray(subs)) {
        const changed = {
          [key]: value
        }
        subs.forEach(function(subFn) {
          if ('function' === typeof subFn)
            subFn(changed)
        })
      }
    }

    /**
     * Call listening function when `set` was called on any of the `keys`.
     * 
     * @param {Array}   keys  Array of keys the function will be subscribing to.
     * @param {Function} fn   Subscribing function.
     */
    subscribe(keys, fn) {
      keys.forEach(function(key) {
        const subs = _subscriptions[key]
        if (Array.isArray(subs)) {
          if (-1 === subs.indexOf(key))
            subs.push(fn)
        } else {
          _subscriptions[key] = [fn]
          return
        }
      })
    }

    /**
     * Unsubscribe function
     * @param  {Function} fn The function to unsubcribe.
     */
    unsubscribe(fn) {
      Object.keys(_subscriptions).forEach(function(key) {
        const subs = _subscriptions[key]
        if (Array.isArray(subs))
          _subscriptions[key] = subs.filter((f) => f !== fn)
      })
    }
  }


  /**
   * Return a new instance of Store
   */
  return new Store()
}
export function isPlainObject(obj) {
  return obj && 'object' === typeof obj && !Array.isArray(obj)
}
