import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: 'user:read', name: 'View Users', description: 'View user list and details' },
  { code: 'user:write', name: 'Edit Users', description: 'Edit user information' },
  { code: 'user:disable', name: 'Disable Users', description: 'Disable or enable user accounts' },
  { code: 'system_config:read', name: 'View System Config', description: 'View system configuration' },
  { code: 'system_config:write', name: 'Edit System Config', description: 'Modify system configuration' },
  { code: 'dashboard:view', name: 'View Dashboard', description: 'Access dashboard and analytics' },
  { code: 'content:moderate', name: 'Moderate Content', description: 'Review and moderate flagged content' },
  { code: 'audit:view', name: 'View Audit Logs', description: 'View system audit logs' },
  { code: 'role:view', name: 'View Roles', description: 'View roles and permissions' },
  { code: 'role:write', name: 'Edit Roles', description: 'Create and edit roles and permissions' },
  { code: '*', name: 'Super Admin', description: 'Full access to all resources' },
];

const DEFAULT_CONFIGS = [
  { key: 'quota.free.dailyChatLimit', value: '30', description: 'Daily chat message limit for free tier users' },
  { key: 'quota.pro.dailyChatLimit', value: '300', description: 'Daily chat message limit for pro tier users' },
];

async function main() {
  console.log('Seeding database...');

  // Upsert permissions
  const permissionRecords = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, description: p.description },
        create: p,
      })
    )
  );
  console.log(`Upserted ${permissionRecords.length} permissions`);

  // Upsert super admin role
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: { description: 'Super administrator with full access' },
    create: { name: 'super_admin', description: 'Super administrator with full access' },
  });
  console.log(`Upserted role: ${superAdminRole.name}`);

  // Assign all permissions to super admin role
  for (const perm of permissionRecords) {
    await prisma.adminRolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });
  }
  console.log('Assigned all permissions to super_admin role');

  // Upsert default admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      nickname: 'Super Admin',
      status: 'ACTIVE',
    },
  });
  console.log(`Upserted admin user: ${adminUser.username}`);

  // Assign super admin role to admin user
  await prisma.adminRoleAssignment.upsert({
    where: { adminId_roleId: { adminId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { adminId: adminUser.id, roleId: superAdminRole.id },
  });
  console.log('Assigned super_admin role to admin user');

  // Upsert system configs
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { description: cfg.description },
      create: cfg,
    });
  }
  console.log(`Upserted ${DEFAULT_CONFIGS.length} system configs`);

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
