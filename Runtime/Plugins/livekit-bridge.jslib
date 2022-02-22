var NativeLib = {
	$BridgeData: null,
	$BridgePtr: null,
	$RefCounter: 1,
	$Stack: [],
	$StackCSharp: [],
	$nullptr: 0,

	$NewRef: function () {
		return RefCounter++;
	},

	$SetRef: function (ptr, obj) {
		BridgeData.set(ptr, obj);

		if (typeof val === 'object' && obj !== null) {
			BridgePtr.set(obj, ptr);
        }
	},

	$GetOrNewRef: function (obj) {
		var ptr = BridgePtr.get(obj);
		if (ptr === undefined || typeof val !== 'object' || obj === null) {
			ptr = NewRef();
			SetRef(ptr, obj);
		}

		return ptr;
	},

	Init: function () {
		// When initializing these variables directly, emscripten replace the type by {} (not sure why)
		BridgeData = new Map();
		BridgePtr = new Map();
    },

	NewRef: function () {
		return NewRef();
	},

	FreeRef: function (ptr) {
		var obj = BridgeData.get(ptr);
		BridgePtr.delete(obj);
		BridgeData.delete(ptr);
	},

	CopyRef: function (ptr) {
		var obj = BridgeData.get(ptr);
		var ref = NewRef();
		SetRef(ref, obj);
		return ref;
	},

	GetProperty: function (ptr, str) {
		str = Pointer_stringify(str);
		var obj;
		if (ptr == nullptr) {
			obj = window[str];
		} else {
			var p = BridgeData.get(ptr);
			if (p === undefined)
				return nullptr;

			obj = p[str];
        }

		if (!obj)
			return nullptr;

		return GetOrNewRef(obj);
	},

	IsNull: function (ptr) {
		return BridgeData.get(ptr) === null;
	},

	IsUndefined: function (ptr) {
		return BridgeData.get(ptr) === undefined;
	},

	IsString: function (ptr) {
		var obj = BridgeData.get(ptr);
		return typeof obj === 'string' || obj instanceof String;
	},

	IsObject: function (ptr) {
		var obj = BridgeData.get(ptr);
		return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
	},

	IsArray: function (ptr) {
		var obj = BridgeData.get(ptr);
		return Array.isArray(obj);
	},

	PushNull: function () {
		Stack.push(null);
	},

	PushNumber: function (nb) {
		Stack.push(nb);
	},

	PushBoolean: function (bool) {
		Stack.push(bool);
	},

	PushString: function (str) {
		Stack.push(Pointer_stringify(str));
	},

	PushStruct: function (json) {
		Stack.push(JSON.parse(Pointer_stringify(json)));
	},

	PushFunction: function (ptr, fnc) {
		Stack.push(function () {
			StackCSharp = Array.from(arguments);
			Runtime.dynCall("vi", fnc, [ptr]);
			StackCSharp = [];
        });
	},

	CallFunction: function (str) {
		var returnptr = NewRef();
		var fnc = window[Pointer_stringify(str)];
		var result = fnc.apply(null, Stack);
		SetRef(returnptr, result);
		Stack = [];
		return returnptr;
	},

	CallMethod: function (ptr, str) {
		var returnptr = NewRef();
		var obj = BridgeData.get(ptr);
		var fnc = obj[Pointer_stringify(str)]
		var result = fnc.apply(obj, Stack);
		SetRef(returnptr, result);
		Stack = [];
		return returnptr;
	},

	NewInstance: function (ptr, toPtr, clazz) {
		var obj;
		if (ptr == 0) {
			obj = window;
		} else {
			obj = BridgeData.get(ptr);
		}

		var inst = new (Function.prototype.bind.apply(obj[Pointer_stringify(clazz)], Stack));
		SetRef(toPtr, inst);
		Stack = [];
	},

	ShiftStack: function () {
		var v = StackCSharp.shift();
		return GetOrNewRef(v);
    },

	GetString: function (ptr) {
		var value = BridgeData.get(ptr);
		var bufferSize = lengthBytesUTF8(value) + 1;
		var buffer = _malloc(bufferSize);
		stringToUTF8(value, buffer, bufferSize);
		return buffer;
	},

	GetNumber: function (ptr) {
		var value = BridgeData.get(ptr);
		return value;
	},

	GetBool: function (ptr) {
		var value = BridgeData.get(ptr);
		return value;
	},

	GetDataPtr: function (ptr) {
		var value = BridgeData.get(ptr);
		var arr = new Uint8Array(value);
		var ptr = _malloc(arr.byteLength + 4);
		HEAP32.set([arr.length], ptr >> 2); // First 4 bytes is the size of the array 
		HEAPU8.set(arr, ptr + 4);
		setTimeout(function () {
			_free(ptr);
		}, 0);
		return ptr;
	},

	// Video Receive
	NewTexture: function () {
		var tex = GLctx.createTexture();
		if (!tex)
			return nullptr;

		var id = GL.getNewId(GL.textures);
		tex.name = id;
		GL.textures[id] = tex;
		return id;
	},

	DestroyTexture: function (ptr) {
		GLctx.deleteTexture(ptr);
	},

	AttachVideo: function (texId, videoPtr) {
		var attachPtr = NewRef();
		SetRef(attachPtr, true);

		var tex = GL.textures[texId];
		var video = BridgeData.get(videoPtr);
		var lastTime = -1;

		var updateVideo = function () {
			if (!BridgeData.get(attachPtr))
				return; // Detached

			var time = video.currentTime;
			if (time !== lastTime) {
				GLctx.bindTexture(GLctx.TEXTURE_2D, tex);

				// Flip
				GLctx.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				GLctx.texImage2D(GLctx.TEXTURE_2D, 0, GLctx.RGBA, GLctx.RGBA, GLctx.UNSIGNED_BYTE, video);
				GLctx.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

				GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MAG_FILTER, GLctx.LINEAR);
				GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_MIN_FILTER, GLctx.LINEAR);
				GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_WRAP_S, GLctx.CLAMP_TO_EDGE);
				GLctx.texParameteri(GLctx.TEXTURE_2D, GLctx.TEXTURE_WRAP_T, GLctx.CLAMP_TO_EDGE);
				GLctx.bindTexture(GLctx.TEXTURE_2D, null);

				lastTime = time;
			}

			requestAnimationFrame(updateVideo);
		};

		requestAnimationFrame(updateVideo);
		return attachPtr;
	},
};

autoAddDeps(NativeLib, '$GetOrNewRef');
autoAddDeps(NativeLib, '$NewRef');
autoAddDeps(NativeLib, '$SetRef');
autoAddDeps(NativeLib, '$BridgeData');
autoAddDeps(NativeLib, '$BridgePtr');
autoAddDeps(NativeLib, '$RefCounter');
autoAddDeps(NativeLib, '$Stack');
autoAddDeps(NativeLib, '$StackCSharp');
autoAddDeps(NativeLib, '$nullptr');

mergeInto(LibraryManager.library, NativeLib);