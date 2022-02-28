using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Scripting;

namespace LiveKit
{
    public class JSMap<TKey, TValue> : JSRef, IDictionary<TKey, TValue>
    {
        public ICollection<TKey> Keys
        {
            get 
            {
                var keys = Acquire(JSNative.CallMethod(NativePtr, "keys"));
                
                JSNative.PushString("Array");
                var array = Acquire(JSNative.GetProperty(IntPtr.Zero));

                JSNative.PushObject(keys.NativePtr);
                return Acquire<JSArray<TKey>>(JSNative.CallMethod(array.NativePtr, "from"));
            }
        }

        public ICollection<TValue> Values
        {
            get
            {
                var values = Acquire(JSNative.CallMethod(NativePtr, "values"));

                JSNative.PushString("Array");
                var array = Acquire(JSNative.GetProperty(IntPtr.Zero));

                JSNative.PushObject(values.NativePtr);
                return Acquire<JSArray<TValue>>(JSNative.CallMethod(array.NativePtr, "from"));
            }
        }

        public int Count
        {
            get
            {
                JSNative.PushString("size");
                var ptr = Acquire(JSNative.GetProperty(NativePtr));
                return (int) JSNative.GetNumber(ptr.NativePtr);
            }
        }

        public bool IsReadOnly => false;

        public TValue this[TKey key] 
        {
            get
            {
                if (!ContainsKey(key))
                    throw new KeyNotFoundException();

                PushKey(key);
                var ptr = Acquire(JSNative.CallMethod(NativePtr, "get"));
                if(JSNative.IsPrimitive(typeof(TValue)))
                    return (TValue) JSNative.GetPrimitive(ptr.NativePtr);

                return (TValue)(object)Acquire(ptr.NativePtr);
            }
            set
            {
                PushKey(key);
                PushValue(value);
                Acquire(JSNative.CallMethod(NativePtr, "set"));
            }
        }

        public JSMap() : this(JSNative.NewRef())
        {
            JSNative.NewInstance(IntPtr.Zero, NativePtr, "Map");
        }

        [Preserve]
        public JSMap(IntPtr ptr) : base(ptr)
        {

        }

        public void Add(TKey key, TValue value)
        {
            if(ContainsKey(key)) 
                throw new ArgumentException("Key already exits");

            this[key] = value;
        }

        public bool ContainsKey(TKey key)
        {
            PushKey(key);
            var cref = Acquire(JSNative.CallMethod(NativePtr, "has"));
            return JSNative.GetBoolean(cref.NativePtr);
        }

        public bool Remove(TKey key)
        {
            PushKey(key);
            var cref = Acquire(JSNative.CallMethod(NativePtr, "delete"));
            return JSNative.GetBoolean(cref.NativePtr);
        }

        public bool TryGetValue(TKey key, out TValue value)
        {
            if (!ContainsKey(key))
            {
                value = default(TValue);
                return false;
            }

            value = this[key];
            return true;
        }

        public void Add(KeyValuePair<TKey, TValue> item)
        {
            Add(item.Key, item.Value);
        }

        public void Clear()
        {
            Acquire(JSNative.CallMethod(NativePtr, "clear"));
        }

        public bool Contains(KeyValuePair<TKey, TValue> item)
        {
            if(TryGetValue(item.Key, out var cref))
                return cref.Equals(item.Value);

            return false;
        }

        public void CopyTo(KeyValuePair<TKey, TValue>[] array, int arrayIndex)
        {
            foreach (var p in this)
                array[arrayIndex++] = p;
        }

        public bool Remove(KeyValuePair<TKey, TValue> item)
        {
            if (TryGetValue(item.Key, out TValue v) && item.Value.Equals(v))
                return Remove(item.Key);

            return false;
        }

        public IEnumerator<KeyValuePair<TKey, TValue>> GetEnumerator()
        {
            foreach(var k in Keys)
                yield return new KeyValuePair<TKey, TValue>(k, this[k]);
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }

        private void PushKey(TKey key)
        {
            if (JSNative.IsPrimitive(typeof(TKey)))
                JSNative.PushPrimitive(key);
            else
                JSNative.PushObject((key as JSRef).NativePtr);
        }

        private void PushValue(TValue value)
        {
            if (JSNative.IsPrimitive(typeof(TValue)))
                JSNative.PushPrimitive(value);
            else
                JSNative.PushObject((value as JSRef).NativePtr);
        }
    }
}