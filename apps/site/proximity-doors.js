import * as THREE from '../shared/vendor/three.module.js';

// These distances and timings are navigation behaviour in model units, not
// specifications for the photographed doors or their real control hardware.
export const PROXIMITY_DOOR_RULES = Object.freeze({
  openDistance: 2.2, closeDistance: 3.1, closeDelay: .45,
  interactionDistance: 2.2,
  openDuration: .48, closeDuration: .62, maxDelta: .1,
});

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const visible = (node) => {
  for (let current = node; current; current = current.parent) if (!current.visible) return false;
  return true;
};
const smoothstep = (value) => value * value * (3 - 2 * value);

// Only reviewed enterable:true architectural leaves participate. Manual mode
// is the default; the UI explicitly enables approach sensors with autoOpen.
// trigger is the threshold centre in the leaf parent's space. The default +Z
// normal can be overridden for transverse curtains authored across local X.
// Metadata stays JSON serializable for exports and inspection.
export function createProximityDoorController(root) {
  const doors = [], groups = [], namedGroups = new Map(), parentGroups = new Map();
  root?.traverse(node => {
    const data = node.userData?.proximityDoor;
    if (!data || data.enterable !== true || !node.parent || !['hinge', 'slide', 'lift'].includes(data.kind) || !Number.isFinite(data.closed) || !Number.isFinite(data.open)) return;
    const axis = ['x', 'y', 'z'].includes(data.axis) ? data.axis : 'y';
    const trigger = Array.isArray(data.trigger) && data.trigger.length === 3 && data.trigger.every(Number.isFinite) ? data.trigger : [0, 0, 0];
    const door = { node, parent: node.parent, data, axis, closedScale: node.scale[axis], trigger: new THREE.Vector3(...trigger), progress: 0, requestedOpen: false, hold: 0 };
    doors.push(door);
    // Twin swing leaves and telescopic panels form one interaction. Explicit
    // groupId values can also join panels with different parent transforms.
    let group,scope='';
    for(let ancestor=node.parent;ancestor;ancestor=ancestor.parent)if(ancestor.userData?.equipment){scope=String(ancestor.userData.equipment);break;}
    const namedId=typeof data.groupId==='string' && data.groupId ? `${scope?`${scope}:`:''}${data.groupId}` : null;
    if (namedId) group=namedGroups.get(namedId);
    else group=parentGroups.get(node.parent)?.get(JSON.stringify(trigger));
    if (!group) {
      group={ id: namedId || `door-${groups.length+1}`, doors: [], label: data.label || node.parent.userData?.name || node.parent.userData?.label || '출입문' };
      groups.push(group);
      if(namedId) namedGroups.set(namedId,group);
      else { if(!parentGroups.has(node.parent))parentGroups.set(node.parent,new Map());parentGroups.get(node.parent).set(JSON.stringify(trigger),group); }
    }
    group.doors.push(door);
  });
  const point = new THREE.Vector3(), scale = new THREE.Vector3();
  const groupPoint = new THREE.Vector3(), direction = new THREE.Vector3();
  let disposed = false;
  function apply(door) {
    const eased = smoothstep(door.progress);
    const value = door.data.closed + (door.data.open - door.data.closed) * eased;
    const transform = door.data.kind === 'hinge' ? door.node.rotation : door.node.position;
    transform[door.axis] = value;
    // A roller curtain gathers inside its fixed header instead of extending
    // a full-height sheet through the roof when it opens.
    if (door.data.kind === 'lift' && door.data.retract) {
      const openScale = Math.max(.005, Math.min(1, finite(door.data.openScale, .035)));
      door.node.scale[door.axis] = door.closedScale * (1 - (1 - openScale) * eased);
    }
    door.node.updateMatrix();
  }
  function reset() {
    for (const door of doors) { door.progress = 0; door.requestedOpen = false; door.hold = 0; apply(door); }
  }
  function coordinates(value) {
    const array=Array.isArray(value) ? value : value?.isVector3 ? value.toArray() : null;
    return array?.length===3 && array.every(Number.isFinite) ? array : null;
  }
  function measure(group, position) {
    groupPoint.set(0,0,0);
    let count=0,height=.5,width=0,openDistance=0,closeDistance=0,interactionDistance=0;
    for(const door of group.doors) {
      if(!visible(door.node))continue;
      door.parent.updateWorldMatrix(true,false);door.parent.getWorldScale(scale);
      point.copy(door.trigger).applyMatrix4(door.parent.matrixWorld);groupPoint.add(point);count++;
      width=Math.max(width,Math.max(0,finite(door.data.width,1))*Math.max(Math.abs(scale.x),Math.abs(scale.z)));
      height=Math.max(height,finite(door.data.height,2.2)*Math.abs(scale.y));
      openDistance=Math.max(openDistance,finite(door.data.openDistance,0));
      closeDistance=Math.max(closeDistance,finite(door.data.closeDistance,0));
      interactionDistance=Math.max(interactionDistance,finite(door.data.interactionDistance,PROXIMITY_DOOR_RULES.interactionDistance));
    }
    if(!count)return null;
    groupPoint.multiplyScalar(1/count);
    openDistance=Math.max(.1,openDistance||Math.max(PROXIMITY_DOOR_RULES.openDistance,width/2+.8));
    closeDistance=Math.max(openDistance+.2,closeDistance||Math.max(PROXIMITY_DOOR_RULES.closeDistance,openDistance+.9));
    const sameHeight=position && Math.abs(position[1]-groupPoint.y)<=Math.min(1.3,height/2+.2);
    return { distance:sameHeight ? Math.hypot(position[0]-groupPoint.x,position[2]-groupPoint.z) : Infinity,
      width,height,openDistance,closeDistance,interactionDistance:Math.max(.1,interactionDistance),point:groupPoint.clone() };
  }
  function nearest(position, { direction: facing } = {}) {
    const at=coordinates(position);if(disposed || !at)return null;
    const forward=coordinates(facing);
    if(forward)direction.set(forward[0],0,forward[2]).normalize();
    let nearest=null;
    for(const group of groups) {
      const info=measure(group,at);
      if(!info || info.distance>info.interactionDistance)continue;
      if(forward && direction.lengthSq()>.1 && info.distance>.6) {
        const toward=new THREE.Vector3(info.point.x-at[0],0,info.point.z-at[2]).normalize();
        if(toward.dot(direction)<.15)continue;
      }
      if(!nearest || info.distance<nearest.info.distance)nearest={group,info};
    }
    return nearest;
  }
  reset();
  return {
    get count() { return doors.length; },
    get groupCount() { return groups.length; },
    reset,
    getPassages({ includeAll = false } = {}) {
      if(disposed)return [];
      const passages=[];
      for(const group of groups) {
        const door=group.doors.find(leaf=>leaf.data.portal && visible(leaf.node)) ||
          (includeAll ? group.doors.find(leaf=>visible(leaf.node)) : null);
        if(!door)continue;
        const info=measure(group,null);if(!info)continue;
        const localNormal=coordinates(door.data.normal),normal=new THREE.Vector3(...(localNormal||[0,0,1]));
        if(normal.lengthSq()<1e-12)normal.set(0,0,1);
        normal.transformDirection(door.parent.matrixWorld);
        passages.push({id:group.id,point:info.point.toArray(),normal:normal.toArray(),
          width:info.width,height:info.height,
          open:group.doors.filter(leaf=>visible(leaf.node)).every(leaf=>leaf.progress>.85),portal:door.data.portal});
      }
      return passages;
    },
    getInteraction(position, options = {}) {
      const found=nearest(position,options);if(!found)return null;
      return { id:found.group.id,label:found.group.label,action:found.group.doors.some(door=>door.requestedOpen)?'close':'open',distance:found.info.distance };
    },
    toggleNearest(position, options = {}) {
      const found=nearest(position,options);if(!found)return false;
      const open=!found.group.doors.some(door=>door.requestedOpen);
      for(const door of found.group.doors){door.requestedOpen=open;door.hold=0;}
      return true;
    },
    setPassageOpen(id, open, { immediate = false } = {}) {
      const group=!disposed && groups.find(item=>item.id===id);if(!group)return false;
      for(const door of group.doors) {
        door.requestedOpen=!!open;door.hold=0;
        if(immediate){door.progress=open?1:0;apply(door);}
      }
      return true;
    },
    update(position, elapsed = 0, { autoOpen = false, reducedMotion = false, enabled = true } = {}) {
      if (disposed || !doors.length) return false;
      const at=coordinates(position),hasPerson=enabled && !!at;
      const dt = Math.min(PROXIMITY_DOOR_RULES.maxDelta, Math.max(0, finite(elapsed, 0)));
      let animating = false;
      for(const group of groups) {
        const info=autoOpen && enabled ? measure(group,hasPerson?at:null) : null;
        if(!enabled) { for(const door of group.doors){door.requestedOpen=false;door.hold=0;} }
        else if(autoOpen && info) {
          const requested=group.doors.some(door=>door.requestedOpen);
          if(info.distance<=info.openDistance)for(const door of group.doors){door.requestedOpen=true;door.hold=0;}
          else if(requested && info.distance>info.closeDistance) {
            for(const door of group.doors) {
              door.hold+=dt;
              if(door.hold>=Math.max(0,finite(door.data.closeDelay,PROXIMITY_DOOR_RULES.closeDelay))){door.requestedOpen=false;door.hold=0;}
              else animating=true;
            }
          } else for(const door of group.doors)door.hold=0;
        }
      }
      for (const door of doors) {
        if (!visible(door.node)) {
          if (door.progress || door.requestedOpen) { door.progress = 0; door.requestedOpen = false; door.hold = 0; apply(door); }
          continue;
        }
        const target = door.requestedOpen ? 1 : 0;
        if (Math.abs(door.progress - target) > 1e-8) {
          const duration = Math.max(.05, finite(door.requestedOpen ? door.data.openDuration : door.data.closeDuration, door.requestedOpen ? PROXIMITY_DOOR_RULES.openDuration : PROXIMITY_DOOR_RULES.closeDuration));
          door.progress = reducedMotion ? target : Math.max(0, Math.min(1, door.progress + (target ? 1 : -1) * dt / duration));
          apply(door);
          // Render the last transform as well as every intermediate frame.
          animating = true;
        }
      }
      return animating;
    },
    dispose() { reset(); disposed = true; doors.length = 0; groups.length=0;namedGroups.clear();parentGroups.clear(); },
  };
}
