//=======//
// Setup //
//=======//
const makeAtom = ({
	width = 50,
	height = 50,
	x = WORLD_WIDTH/2 - width/2,
	y = WORLD_HEIGHT/2 - height/2,
	dx = 0,
	dy = 0,
	draw = DRAW_RECTANGLE,
	update = UPDATE_STATIC,
	grab = GRAB_DRAG,
	turns = 0,
	cutTop = 0,
	cutBottom = 0,
	cutRight = 0,
	cutLeft = 0,
	autoLinks = [],
	...args
} = {}) => {
	const atom = {
		width,
		height,
		cutTop,
		cutBottom,
		cutRight,
		cutLeft,
		x,
		y,
		dx,
		dy,
		nextdx: dx,
		nextdy: dy,
		turns: 0,
		nextturns: 0,
		draw,
		update,
		grab,
		flipX: false,
		portals: {top: undefined, bottom: undefined, left: undefined, right: undefined},
		children: [],
		links: [],
		...args
	}
	for (const autoLink of autoLinks) {
		const latom = makeAtom(autoLink.element)
		linkAtom(atom, latom, autoLink.offset, autoLink.transfer)
	}
	turnAtom(atom, turns)
	return atom
}

//===========//
// Game Loop //
//===========//
const updateAtom = (atom, world) => {
	atom.update(atom, world)
	updateAtomLinks(atom, world)
}

const updateAtomLinks = (atom) => {
	for (const link of atom.links) {
		for (const key of LINKED_PROPERTIES) {
			if (link.transfer[key] !== undefined) {
				const them = atom[key]
				const me = link.atom[key]
				atom[key] = link.transfer[key](them, me)
			}

			if (link.offset[key] !== undefined) {
				const them = atom[key]
				const me = link.atom[key]
				link.atom[key] = link.offset[key](them, me)
			}
			else {
				link.atom[key] = atom[key]
			}
		}
		updateAtomLinks(link.atom)
	}
}

const drawAtom = (atom, context) => {
	const {draw} = atom
	draw(atom, context)
}

//=========//
// Usefuls //
//=========//
const linkAtom = (atom, latom, offset={}, transfer={}) => {
	atom.links.push({atom: latom, offset, transfer})
	latom.parent = atom
}

const moveAtom = (atom, x, y) => {
	atom.x = x
	atom.y = y
	updateAtomLinks(atom)
}

const flipAtom = (atom) => {
	atom.flipX = !atom.flipX
	const [cutLeft, cutRight] = [atom.cutRight, atom.cutLeft]
	const cutDiff = cutLeft - cutRight
	atom.cutLeft = cutLeft
	atom.cutRight = cutRight
	atom.x -= cutDiff
}

const turnAtom = (atom, turns=1, fallSafe=false, rejectIfOverlap=false, world, exceptions=[]) => {
	if (atom.turns === undefined) atom.turns = 0
	if (turns === 0) return
	if (turns < 0) return turnAtom(atom, 4+turns, fallSafe, rejectIfOverlap, world, exceptions=[])
	if (turns > 1) {
		turnAtom(atom, 1, fallSafe, rejectIfOverlap, world, exceptions=[])
		turnAtom(atom, turns-1, fallSafe, rejectIfOverlap, world, exceptions=[])
		return
	}
	const old = {}
	const obounds = getBounds(atom)
	const {height, width, cutTop, cutBottom, cutRight, cutLeft} = atom
	old.height = height
	old.width = width
	old.cutTop = cutTop
	old.cutBottom = cutBottom
	old.cutLeft = cutLeft
	old.cutRight = cutRight
	atom.height = width
	atom.width = height
	atom.cutBottom = cutRight
	atom.cutLeft = cutBottom
	atom.cutTop = cutLeft
	atom.cutRight = cutTop

	// TODO: rotate the link offsets and transfers!
	// but make sure you make a copy of it first in case the rotation is not possible and u gotta reverse

	if (rejectIfOverlap) {
		
		old.y = atom.y
		old.x = atom.x
		const nbounds = getBounds(atom)
		atom.y -= nbounds.bottom-obounds.bottom + 1
		atom.x -= (atom.width-atom.height)/2
		for (const a of world.atoms) {
			if (a === atom) continue
			if (exceptions.includes(a)) continue
			if (atomOverlaps(atom, a)) {
				//const bounds = getBounds(atom)
				//const abounds = getBounds(a)
				//if (abounds.top === bounds.bottom) continue
				for (const key in old) {
					atom[key] = old[key]
				}
				return false
			}
		}

	}
	atom.turns++
	if (atom.turns >= 4) atom.turns = 0
}

const getBounds = ({x, y, width, height, cutTop=0, cutBottom=0, cutLeft=0, cutRight=0}) => {
	const top = y + cutTop
	const bottom = y + height - cutBottom
	const left = x + cutLeft
	const right = x + width - cutRight
	return {top, bottom, left, right}
}

const pointOverlaps = ({x, y}, atom) => {
	const {left, right, top, bottom} = getBounds(atom)
	return x >= left && x <= right && y >= top && y <= bottom
}

const atomIsDescendant = (kid, parent) => {
	if (kid.parent === parent) return true
	if (kid.parent === undefined) return false
	return atomIsDescendant(kid.parent, parent)
}


const atomOverlaps = (self, atom) => {

	if (atomIsDescendant(self, atom)) return false
	if (atomIsDescendant(atom, self)) return false

	for (const link of self.links) {
		const result = atomOverlaps(link.atom, atom)
		if (result) return true
	}

	const bounds = getBounds(self)
	const abounds = getBounds(atom)

	const horizAligns = aligns([bounds.left, bounds.right], [], [abounds.left, abounds.right])
	const vertAligns = aligns([bounds.top, bounds.bottom], [], [abounds.top, abounds.bottom])
	if (horizAligns && vertAligns) return true
	//if (horizAligns && bounds.top <= abounds.top && bounds.bottom >= abounds.bottom) return true
	//if (horizAligns && bounds.left <= abounds.left && bounds.right >= abounds.right) return true

	const ahorizAligns = aligns([abounds.left, abounds.right], [], [bounds.left, bounds.right])
	const avertAligns = aligns([abounds.top, abounds.bottom], [], [bounds.top, bounds.bottom])
	if (ahorizAligns && avertAligns) return true
	//if (ahorizAligns && abounds.top <= bounds.top && abounds.bottom >= bounds.bottom) return true
	//if (avertAligns && abounds.left <= bounds.left && abounds.right >= bounds.right) return true

	return false
}

const getPointSide = (point, [left, right]) => {
	if (point < left) return -1
	if (point > right) return 1
	return 0
}

const aligns = ([left, right], [nleft, nright], [aleft, aright=aleft]) => {
	const leftSide = getPointSide(left, [aleft, aright])
	const rightSide = getPointSide(right, [aleft, aright])
	if (leftSide === 0) return true
	if (rightSide === 0) return true
	if (leftSide*-1 == rightSide) return true

	// For moving things
	if (nleft !== undefined && nright !== undefined) {
		const nleftSide = getPointSide(nleft, [aleft, aright])
		const nrightSide = getPointSide(nright, [aleft, aright])
		if (nleftSide === 0) return true
		if (nrightSide === 0) return true
		if (leftSide*-1 == nleftSide) return true
		if (rightSide*-1 == nrightSide) return true
	}

	return false
}