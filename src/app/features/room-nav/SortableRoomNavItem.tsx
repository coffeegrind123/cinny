import React, { useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { RoomNavItem } from './RoomNavItem';
import { SortableNavItem } from './styles.css';
import { RoomNotificationMode } from '../../hooks/useRoomsNotificationPreferences';

type SortableRoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  direct?: boolean;
  parentId: string;
  canReorder: boolean;
  onReorder: (parentId: string, fromRoomId: string, toRoomId: string) => void;
};

type DragPayload = { roomId: string; parentId: string };

// Module-level slot for the active drag, readable during dragover (dataTransfer
// is not readable in dragover in all browsers).
let activeDrag: DragPayload | null = null;

export function SortableRoomNavItem({
  room,
  selected,
  linkPath,
  notificationMode,
  showAvatar,
  direct,
  parentId,
  canReorder,
  onReorder,
}: SortableRoomNavItemProps) {
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const payload: DragPayload = { roomId: room.roomId, parentId };
    activeDrag = payload;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', room.roomId);
    setDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!activeDrag) return;
    if (activeDrag.parentId !== parentId || activeDrag.roomId === room.roomId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(true);
  };

  const handleDragLeave = () => {
    setDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropTarget(false);
    if (activeDrag && activeDrag.parentId === parentId && activeDrag.roomId !== room.roomId) {
      onReorder(parentId, activeDrag.roomId, room.roomId);
    }
    activeDrag = null;
  };

  const handleDragEnd = () => {
    setDragging(false);
    setDropTarget(false);
    activeDrag = null;
  };

  return (
    <div
      className={SortableNavItem}
      data-dragging={dragging}
      data-drop-target={dropTarget ? 'before' : undefined}
      draggable={canReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <RoomNavItem
        room={room}
        selected={selected}
        showAvatar={showAvatar}
        direct={direct}
        linkPath={linkPath}
        notificationMode={notificationMode}
      />
    </div>
  );
}
