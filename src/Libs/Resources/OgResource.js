import { set, get, isObject } from 'lodash'
import OgResourceCast from './OgResourceCast'
import OgQueryBuilder from '~/Bxpert/Sdk/src/Libs/Http/OgQueryBuilder'
import OgResponse from '~/Bxpert/Sdk/src/Libs/Http/OgResponse'

const getCastValue = (config, key, casts = {}, value = null) => {
  if (!casts[key]) {
    return value
  }

  const type = casts[key]

  if (OgResourceCast.isPrototypeOf(type) || OgResource.isPrototypeOf(type)) {
    return new type(config, value)
  }

  let output

  switch (type) {
    case 'boolean':
      output = value ? Boolean(value) : false
      break
    case 'string':
      output = value ? String(value) : ''
      break
    case 'integer':
      output = parseInt(value, 10) || 0
      break
    case 'decimal':
      output = parseFloat(value) || 0.0
      break
    default:
      output = value
      break
  }

  return output
}

/**
 * Base class to interact with an entity
 * on the API.
 * @author Delvi Marte <dmarte@famartech.com>
 */
export default class OgResource extends OgQueryBuilder {
  /**
   * @param {OgApi} api
   * @param {Object} attributes
   * @param {String} path String path used to fetch to the API.
   */
  constructor(api, attributes = {}, path = '') {
    super(api.config)
    this.$api = api
    this.$response = new OgResponse(api.config)
    this.$fillable = []
    this.$casts = {}
    this.$attributes = {}
    this.$primaryKey = 'id'
    this.$status = {
      updating: false,
      fetching: false,
      creating: false,
      deleting: false
    }
    this.$path = path || '/'
    this.fill(attributes)
  }

  fail(path) {
    return this.$response.fail(path)
  }

  state(path) {
    return this.$response.state(path)
  }

  feedback(path) {
    return this.$response.feedback(path)
  }

  _statusReset() {
    this.$status.creating = false
    this.$status.updating = false
    this.$status.deleting = false
    this.$status.fetching = false
    return this
  }

  reset() {
    this.$attributes = this.toJSON()
  }

  abort() {
    this.$api.abort()
    this._statusReset()
    this.$response.clear()
    this.reset()
  }

  async save() {
    this.$api.abort()
    this._statusReset()
    this.$response.clear()
    this.$status.creating = true
    this.$response = await this.$api.post(this.$path, this.toJSON())
    if (this.$response.failed) {
      this._statusReset()
      throw new Error(this.$response.message)
    }
    this.fill(this.$response.data)
    this.$status.creating = false
    return this
  }

  /**
   * Used to define a set of attributes
   * to be casted.
   *
   * @param {Object} casts
   * @returns {OgResource}
   */
  define(casts = {}) {
    Object.keys(casts).forEach((path) => {
      this.cast(path, casts[path])
    })
    this.$attributes = this.toJSON()
    return this
  }

  /**
   * Set an attribute to be casted to given type.
   *
   * NOTE: When you cast a vaiue, this means tha
   * value should be fillable by the resource.
   * The SDK will automatically set the pat as fillable.
   *
   * @param {String} path
   * @param {*} type
   * @returns {OgResource}
   */
  cast(path, type) {
    this.$casts[path] = type
    this.fillable(path)
    return this
  }

  /**
   * Define a path of a given resource
   * as fillable.
   *
   * @param {String} path
   * @returns {OgResource}
   */
  fillable(path) {
    this.$fillable.push(path)
    return this
  }

  /**
   * Fill a set of attributes.
   *
   * @param {Object} attributes
   * @returns {OgResource}
   */
  fill(attributes) {
    this.$fillable.forEach((path) => {
      const value = get(attributes, path, null)
      if (!value) {
        return
      }
      this.set(path, value)
    })
    return this
  }

  set(path, value) {
    if (!this.$fillable.includes(path)) {
      return this
    }
    set(
      this.$attributes,
      path,
      getCastValue(this.$api.config, path, this.$casts, value)
    )
    return this
  }

  get(path, defaultValue = null) {
    const value = get(this.$attributes, path, defaultValue)
    if (!value) {
      const schema = this.SCHEMA
      return get(schema, path, defaultValue)
    }
    return value
  }

  /**
   * Determine whether or not a given path
   * has a value.
   *
   * NOTE:
   * A path with a value NULL is considered
   * not filled.
   *
   * @param {String} path
   * @returns {boolean}
   */
  filled(path) {
    return get(this.$attributes, path, null) !== null
  }

  toJSON() {
    const out = {}
    Object.keys(this.$casts).forEach((path) => {
      set(out, path, this.get(path))
    })

    return out
  }

  get FAILED_BY_SESSION_EXPIRE() {
    return this.$response.status === OgResponse.HTTP_TOKEN_MISMATCH
  }

  get FAILED_MESSAGE() {
    return this.$response.message
  }

  get FAILED_CODE() {
    return this.$response.status
  }

  get FAILED() {
    return this.$response.failed
  }

  get IS_SAVING() {
    return this.$status.creating || this.$status.updating || false
  }

  get IS_CREATING() {
    return this.$status.creating
  }

  get IS_UPDATING() {
    return this.$status.updating
  }

  get IS_FETCHING() {
    return this.$status.fetching
  }

  get IS_DELETING() {
    return this.$status.deleting
  }

  get ATTRIBUTES() {
    return this.$attributes
  }

  get SCHEMA() {
    const schema = {}
    Object.keys(this.$casts).forEach((path) => {
      set(schema, path, getCastValue(this.$api.config, path, this.$casts, null))
      const value = get(schema, path)
      if (isObject(value) && value instanceof OgResource) {
        set(schema, path, value.SCHEMA)
      }
    })
    return schema
  }
}
