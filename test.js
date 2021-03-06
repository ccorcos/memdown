var test = require('tape')
var testCommon = require('abstract-leveldown/testCommon')
var MemDOWN = require('./').default
var ltgt = require('ltgt')
var Buffer = require('safe-buffer').Buffer
var noop = function () {}

/** compatibility with basic LevelDOWN API **/

// Skip this test because memdown doesn't have a location or constructor options
// require('abstract-leveldown/abstract/leveldown-test').args(MemDOWN, test)

require('abstract-leveldown/abstract/open-test').args(MemDOWN, test, testCommon)
require('abstract-leveldown/abstract/open-test').open(MemDOWN, test, testCommon)

require('abstract-leveldown/abstract/del-test').all(MemDOWN, test)

require('abstract-leveldown/abstract/get-test').all(MemDOWN, test)

require('abstract-leveldown/abstract/put-test').all(MemDOWN, test)

require('abstract-leveldown/abstract/put-get-del-test').all(MemDOWN, test)

require('abstract-leveldown/abstract/batch-test').all(MemDOWN, test)
require('abstract-leveldown/abstract/chained-batch-test').all(MemDOWN, test)

require('abstract-leveldown/abstract/close-test').close(MemDOWN, test)

require('abstract-leveldown/abstract/iterator-test').all(MemDOWN, test)
require('abstract-leveldown/abstract/iterator-range-test').all(MemDOWN, test)

test('unsorted entry, sorted iterator', function (t) {
  var db = new MemDOWN()

  db.open(noop)

  db.put('f', 'F', noop)
  db.put('a', 'A', noop)
  db.put('c', 'C', noop)
  db.put('e', 'E', noop)

  db.batch(
    [
      { type: 'put', key: 'd', value: 'D' },
      { type: 'put', key: 'b', value: 'B' },
      { type: 'put', key: 'g', value: 'G' }
    ],
    noop
  )

  testCommon.collectEntries(
    db.iterator({ keyAsBuffer: false, valueAsBuffer: false }),
    function (err, data) {
      t.notOk(err, 'no error')
      t.equal(data.length, 7, 'correct number of entries')

      var expected = [
        { key: 'a', value: 'A' },
        { key: 'b', value: 'B' },
        { key: 'c', value: 'C' },
        { key: 'd', value: 'D' },
        { key: 'e', value: 'E' },
        { key: 'f', value: 'F' },
        { key: 'g', value: 'G' }
      ]

      t.deepEqual(data, expected)
      t.end()
    }
  )
})

test('reading while putting', function (t) {
  var db = new MemDOWN()

  db.open(noop)

  db.put('f', 'F', noop)
  db.put('c', 'C', noop)
  db.put('e', 'E', noop)

  var iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false })

  iterator.next(function (err, key, value) {
    t.ifError(err, 'no next error')
    t.equal(key, 'c')
    t.equal(value, 'C')

    db.put('a', 'A', noop)

    iterator.next(function (err, key, value) {
      t.ifError(err, 'no next error')
      t.equal(key, 'e')
      t.equal(value, 'E')
      t.end()
    })
  })
})

test('reading while deleting', function (t) {
  var db = new MemDOWN()

  db.open(noop)

  db.put('f', 'F', noop)
  db.put('a', 'A', noop)
  db.put('c', 'C', noop)
  db.put('e', 'E', noop)

  var iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false })

  iterator.next(function (err, key, value) {
    t.ifError(err, 'no next error')
    t.equal(key, 'a')
    t.equal(value, 'A')

    db.del('a', noop)

    iterator.next(function (err, key, value) {
      t.ifError(err, 'no next error')
      t.equal(key, 'c')
      t.equal(value, 'C')
      t.end()
    })
  })
})

test('reverse ranges', function (t) {
  var db = new MemDOWN()

  db.open(noop)

  db.put('a', 'A', noop)
  db.put('c', 'C', noop)

  var iterator = db.iterator({
    keyAsBuffer: false,
    valueAsBuffer: false,
    lte: 'b',
    reverse: true
  })

  iterator.next(function (err, key, value) {
    t.ifError(err, 'no next error')
    t.equal(key, 'a')
    t.equal(value, 'A')
    t.end()
  })
})

test('delete while iterating', function (t) {
  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.put('a', 'A', noop)
  db.put('b', 'B', noop)
  db.put('c', 'C', noop)

  var iterator = db.iterator({
    keyAsBuffer: false,
    valueAsBuffer: false,
    gte: 'a'
  })

  iterator.next(function (err, key, value) {
    t.ifError(err, 'no next error')
    t.equal(key, 'a')
    t.equal(value, 'A')

    db.del('b', function (err) {
      t.notOk(err, 'no error')

      iterator.next(function (err, key, value) {
        t.notOk(err, 'no error')
        t.equals(key, 'b')
        t.equal(value, 'B')
        t.end()
      })
    })
  })
})

test('iterator with byte range', function (t) {
  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.put(Buffer.from('a0', 'hex'), 'A', noop)

  var iterator = db.iterator({ valueAsBuffer: false, lt: Buffer.from('ff', 'hex') })

  iterator.next(function (err, key, value) {
    t.notOk(err, 'no error')
    t.equal(key.toString('hex'), 'a0')
    t.equal(value, 'A')
    t.end()
  })
})

test('iterator does not clone buffers', function (t) {
  t.plan(3)

  var db = new MemDOWN()
  var buf = Buffer.from('a')

  db.open(noop)
  db.put(buf, buf, noop)

  testCommon.collectEntries(db.iterator(), function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.ok(entries[0].key === buf, 'key is same buffer')
    t.ok(entries[0].value === buf, 'value is same buffer')
  })
})

test('iterator stringifies buffer input', function (t) {
  t.plan(3)

  var db = new MemDOWN()

  db.open(noop)
  db.put(1, 2, noop)

  testCommon.collectEntries(db.iterator(), function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.same(entries[0].key, Buffer.from('1'), 'key is stringified')
    t.same(entries[0].value, Buffer.from('2'), 'value is stringified')
  })
})

test('backing rbtree is buffer-aware', function (t) {
  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  var one = Buffer.from('80', 'hex')
  var two = Buffer.from('c0', 'hex')

  t.ok(two.toString() === one.toString(), 'would be equal when not buffer-aware')
  t.ok(ltgt.compare(two, one) > 0, 'but greater when buffer-aware')

  db.put(one, 'one', function (err) {
    t.notOk(err, 'no error')

    db.get(one, { asBuffer: false }, function (err, value) {
      t.notOk(err, 'no error')
      t.equal(value, 'one', 'value one ok')

      db.put(two, 'two', function (err) {
        t.notOk(err, 'no error')

        db.get(one, { asBuffer: false }, function (err, value) {
          t.notOk(err, 'no error')
          t.equal(value, 'one', 'value one is the same')
          t.end()
        })
      })
    })
  })
})

test('empty value in batch', function (t) {
  t.plan(6)

  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.batch([
    {
      type: 'put',
      key: 'empty-string',
      value: ''
    },
    {
      type: 'put',
      key: 'empty-buffer',
      value: Buffer.alloc(0)
    }
  ], function (err) {
    t.error(err, 'no error')

    db.get('empty-string', function (err, val) {
      t.error(err, 'no error')
      t.same(val, Buffer.alloc(0), 'empty string')
    })

    db.get('empty-buffer', function (err, val) {
      t.error(err, 'no error')
      t.same(val, Buffer.alloc(0), 'empty buffer')
    })
  })
})

test('empty buffer key in batch', function (t) {
  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.batch([{
    type: 'put',
    key: Buffer.alloc(0),
    value: ''
  }], function (err) {
    t.ok(err, 'got an error')
    t.end()
  })
})

test('buffer key in batch', function (t) {
  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.batch([{
    type: 'put',
    key: Buffer.from('foo', 'utf8'),
    value: 'val1'
  }], function (err) {
    t.error(err, 'no error')

    db.get(Buffer.from('foo', 'utf8'), { asBuffer: false }, function (err, val) {
      t.error(err, 'no error')
      t.same(val, 'val1')
      t.end()
    })
  })
})

test('put multiple times', function (t) {
  t.plan(5)

  var db = new MemDOWN()

  db.open(function (err) {
    t.error(err, 'opens correctly')
  })

  db.put('key', 'val', function (err) {
    t.error(err, 'no error')

    db.put('key', 'val2', function (err) {
      t.error(err, 'no error')

      db.get('key', { asBuffer: false }, function (err, val) {
        t.error(err, 'no error')
        t.same(val, 'val2')
      })
    })
  })
})

test('number keys', function (t) {
  t.plan(4)

  var db = new MemDOWN()
  var numbers = [2, 12]
  var buffers = numbers.map(stringBuffer)

  db.open(noop)
  db.batch(numbers.map(putKey), noop)

  var iterator1 = db.iterator({ keyAsBuffer: false })
  var iterator2 = db.iterator({ keyAsBuffer: true })

  testCommon.collectEntries(iterator1, function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.same(entries.map(getKey), numbers, 'sorts naturally')
  })

  testCommon.collectEntries(iterator2, function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.same(entries.map(getKey), buffers, 'buffer input is stringified')
  })
})

test('date keys', function (t) {
  t.plan(4)

  var db = new MemDOWN()
  var dates = [new Date(0), new Date(1)]
  var buffers = dates.map(stringBuffer)

  db.open(noop)
  db.batch(dates.map(putKey), noop)

  var iterator = db.iterator({ keyAsBuffer: false })
  var iterator2 = db.iterator({ keyAsBuffer: true })

  testCommon.collectEntries(iterator, function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.same(entries.map(getKey), dates, 'sorts naturally')
  })

  testCommon.collectEntries(iterator2, function (err, entries) {
    t.ifError(err, 'no iterator error')
    t.same(entries.map(getKey), buffers, 'buffer input is stringified')
  })
})

test('object value', function (t) {
  t.plan(2)

  var db = new MemDOWN()
  var obj = {}

  db.open(noop)
  db.put('key', obj, noop)

  db.get('key', { asBuffer: false }, function (err, value) {
    t.ifError(err, 'no get error')
    t.ok(value === obj, 'same object')
  })
})

function stringBuffer (value) {
  return Buffer.from(String(value))
}

function putKey (key) {
  return { type: 'put', key: key, value: 'value' }
}

function getKey (entry) {
  return entry.key
}
