import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';

export const createGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      throw new CustomError('Group name is required', 400);
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        createdById: req.user!.id,
      },
    });

    // Automatically join the creator as member
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: req.user!.id,
        joinedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'GROUP_CREATED',
        entityType: 'Group',
        entityId: group.id,
        details: JSON.stringify({ name }),
      },
    });

    res.status(201).json({ success: true, group });
  } catch (err) {
    next(err);
  }
};

export const getGroups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: req.user!.id, deletedAt: null, group: { deletedAt: null } },
      include: { group: true },
    });

    const groups = memberships.map((m) => m.group);
    res.status(200).json({ success: true, groups });
  } catch (err) {
    next(err);
  }
};

export const getGroupById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        memberships: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    // Check if requester is a member of this group
    const isMember = group.memberships.some((m) => m.userId === req.user!.id);
    if (!isMember && req.user!.role !== 'Admin') {
      throw new CustomError('Access denied: You are not a member of this group', 403);
    }

    res.status(200).json({ success: true, group });
  } catch (err) {
    next(err);
  }
};

export const addMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: groupId } = req.params;
    const { email, joinedAt } = req.body;

    if (!email) {
      throw new CustomError('Member email is required', 400);
    }

    const userToAdd = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!userToAdd) {
      throw new CustomError('User not found', 404);
    }

    // Check if membership already exists
    const existingMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: userToAdd.id, deletedAt: null },
    });

    if (existingMembership) {
      throw new CustomError('User is already a member of this group', 400);
    }

    const joinDate = joinedAt ? new Date(joinedAt) : new Date();

    const membership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: userToAdd.id,
        joinedAt: joinDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'MEMBER_ADDED',
        entityType: 'GroupMembership',
        entityId: membership.id,
        details: JSON.stringify({ groupId, userId: userToAdd.id, joinDate }),
      },
    });

    res.status(201).json({ success: true, membership });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id: groupId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId, deletedAt: null },
    });

    if (!membership) {
      throw new CustomError('Member not found in this group', 404);
    }

    // Set leftAt date to preserve historical membership rather than hard deleting
    const updated = await prisma.groupMembership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'MEMBER_REMOVED',
        entityType: 'GroupMembership',
        entityId: membership.id,
        details: JSON.stringify({ groupId, userId }),
      },
    });

    res.status(200).json({ success: true, message: 'Member successfully removed (left timeline logged)', membership: updated });
  } catch (err) {
    next(err);
  }
};

export const archiveGroup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({ where: { id, deletedAt: null } });
    if (!group) {
      throw new CustomError('Group not found', 404);
    }

    await prisma.group.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'GROUP_ARCHIVED',
        entityType: 'Group',
        entityId: id,
        details: JSON.stringify({}),
      },
    });

    res.status(200).json({ success: true, message: 'Group successfully archived (soft deleted)' });
  } catch (err) {
    next(err);
  }
};
