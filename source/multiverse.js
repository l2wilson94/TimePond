//=======//
// Setup //
//=======//
const makeMultiverse = () => {
	const multiverse = {}
	multiverse.worlds = [makeWorld()]
	multiverse.void = {atoms: []}
	return multiverse
}

const makeMultiverseCanvas = (multiverse) => {
	const stage = Stage.make()
	stage.tick = () => {}
	const {context, canvas} = stage
	canvas.style["background-color"] = Colour.Black
	canvas.style["image-rendering"] = "pixelated"
	on.resize(() => {
		const multiverseHeight = getMultiverseHeight(multiverse, canvas)
		const height = Math.max(multiverseHeight, document.body.clientHeight)
		canvas.height = height
		canvas.style["height"] = height
		canvas.width = document.body.clientWidth
		canvas.style["width"] = document.body.clientWidth
		requestAnimationFrame(() => drawMultiverse(multiverse, context))
	})
	
	setInterval(() => tickMultiverse(multiverse, context), 1000 / 60)
	return canvas
}

//=====//
// API //
//=====//
const addWorld = (multiverse, world) => {
	multiverse.worlds.push(world)
	trigger("resize")
}

//===========//
// Game Loop //
//===========//
const tickMultiverse = (multiverse, context) => {
	updateCursor(multiverse, context)
	updateMultiverse(multiverse)
	drawMultiverse(multiverse, context)
}

const hand = {
	atom: undefined,
	source: undefined,
	offset: {x: undefined, y: undefined},
}
const updateCursor = (multiverse, context) => {
	const [mx, my] = Mouse.position
	const down = Mouse.Left
	const address = getAddress(mx, my, multiverse, context)
	const {world, x, y} = address

	// State: EMPTY HAND
	if (hand.atom === undefined) {

		if (down) {
			for (const atom of world.atoms) {
				if (pointOverlaps({x, y}, atom)) {
					hand.atom = atom
					hand.atom.dx = 0
					hand.atom.dy = 0
					hand.source = world
					hand.offset = {x: atom.x-x, y: atom.y-y}
				}
			}
		}

	}

	// State: HOLDING SOMETHING
	else {
		

		if (world !== hand.source) {
			hand.source.atoms = hand.source.atoms.filter(atom => atom !== hand.atom)
			world.atoms.push(hand.atom)
			hand.source = world
		}
		
		hand.atom.x = x+hand.offset.x
		hand.atom.y = y+hand.offset.y

		if (!down) {
			hand.atom = undefined
		}

	}

}

const updateMultiverse = (multiverse) => {
	if (hand.atom !== undefined) return
	for (const world of multiverse.worlds) {
		updateWorld(world)
	}
}

const drawMultiverse = (multiverse, context) => {
	context.clearRect(0, 0, canvas.width, canvas.height)
	drawWorld(multiverse.void, context)
	let x = 0
	let y = 0
	for (let i = 0; i < multiverse.worlds.length; i++) {
		const world = multiverse.worlds[i]
		drawWorld(world, context)
		if (i >= multiverse.worlds.length-1) break
		x += WORLD_WIDTH
		context.translate(WORLD_WIDTH, 0)
		if (x + WORLD_WIDTH >= context.canvas.width) {
			x = 0
			y += WORLD_HEIGHT
			context.resetTransform()
			context.translate(0, y)
		}
	}
	context.resetTransform()
}

//=========//
// Usefuls //
//=========//
const getAddress = (mx, my, multiverse, context) => {
	const wx = mx % WORLD_WIDTH
	const wy = my % WORLD_HEIGHT
	const column = Math.floor(mx / WORLD_WIDTH)
	const row = Math.floor(my / WORLD_HEIGHT)
	const world = getWorldFromGridPosition(column, row, multiverse, canvas)
	if (world === multiverse.void) return {world, x: mx, y: my}
	const x = mx - column*WORLD_WIDTH
	const y = my - row*WORLD_HEIGHT
	return {world, x, y}
}

const getWorldFromGridPosition = (column, row, multiverse, canvas) => {
	const columns = getGridMaxWidth(canvas)
	if (column >= columns) return multiverse.void
	const world = multiverse.worlds[row*columns + column]
	if (world === undefined) return multiverse.void
	return world
}

const getGridMaxWidth = (canvas) => Math.floor(canvas.width / WORLD_WIDTH)

const getMultiverseHeight = (multiverse, canvas) => {
	let x = 0
	let y = 0
	for (let i = 0; i < multiverse.worlds.length-1; i++) {
		x += WORLD_WIDTH
		if (x + WORLD_WIDTH >= canvas.width) {
			x = 0
			y += WORLD_HEIGHT
		}
	}
	return y + WORLD_HEIGHT
}