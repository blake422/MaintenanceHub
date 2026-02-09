import { db } from "../../db";
import { eq, and, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  UpsertUser,
  Invitation,
  InsertInvitation,
  AccessKey,
  InsertAccessKey,
  SignupRequest,
  InsertSignupRequest,
  PasswordResetToken,
} from "@shared/schema";

export const userRepository = {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  },

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  },

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  },

  async getUsersByCompany(companyId: string): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.companyId, companyId)).orderBy(desc(schema.users.createdAt));
  },

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  },

  // Invitation operations
  async getInvitationsByCompany(companyId: string): Promise<Invitation[]> {
    return await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.companyId, companyId))
      .orderBy(desc(schema.invitations.createdAt));
  },

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.token, token));
    return invitation;
  },

  async getInvitationByEmail(email: string): Promise<Invitation | undefined> {
    const [invitation] = await db
      .select()
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.email, email),
          eq(schema.invitations.status, "pending")
        )
      );
    return invitation;
  },

  async createInvitation(invitationData: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db
      .insert(schema.invitations)
      .values(invitationData)
      .returning();
    return invitation;
  },

  async updateInvitation(id: string, invitationData: Partial<InsertInvitation>): Promise<Invitation | undefined> {
    const [invitation] = await db
      .update(schema.invitations)
      .set({ ...invitationData, updatedAt: new Date() })
      .where(eq(schema.invitations.id, id))
      .returning();
    return invitation;
  },

  async deleteInvitation(id: string): Promise<void> {
    await db.delete(schema.invitations).where(eq(schema.invitations.id, id));
  },

  // Access Key operations
  async getAccessKeyByKey(key: string): Promise<AccessKey | undefined> {
    const [accessKey] = await db
      .select()
      .from(schema.accessKeys)
      .where(eq(schema.accessKeys.key, key));
    return accessKey;
  },

  async getAllAccessKeys(): Promise<AccessKey[]> {
    return await db
      .select()
      .from(schema.accessKeys)
      .orderBy(desc(schema.accessKeys.createdAt));
  },

  async createAccessKey(accessKeyData: InsertAccessKey): Promise<AccessKey> {
    const [accessKey] = await db
      .insert(schema.accessKeys)
      .values(accessKeyData)
      .returning();
    return accessKey;
  },

  async updateAccessKey(id: string, data: Partial<InsertAccessKey>): Promise<AccessKey | undefined> {
    const [accessKey] = await db
      .update(schema.accessKeys)
      .set(data)
      .where(eq(schema.accessKeys.id, id))
      .returning();
    return accessKey;
  },

  async deleteAccessKey(id: string): Promise<void> {
    // Delete associated signup requests (they become orphaned without the access key)
    await db.delete(schema.signupRequests)
      .where(eq(schema.signupRequests.accessKeyId, id));

    // Now delete the access key
    await db.delete(schema.accessKeys).where(eq(schema.accessKeys.id, id));
  },

  async markAccessKeyUsed(id: string, userId: string): Promise<void> {
    await db
      .update(schema.accessKeys)
      .set({ usedById: userId, usedAt: new Date() })
      .where(eq(schema.accessKeys.id, id));
  },

  // Signup Request operations
  async createSignupRequest(requestData: InsertSignupRequest): Promise<SignupRequest> {
    const [request] = await db
      .insert(schema.signupRequests)
      .values(requestData)
      .returning();
    return request;
  },

  async getSignupRequestByEmail(email: string): Promise<SignupRequest | undefined> {
    const [request] = await db
      .select()
      .from(schema.signupRequests)
      .where(eq(schema.signupRequests.email, email));
    return request;
  },

  async getPendingSignupRequests(): Promise<SignupRequest[]> {
    return await db
      .select()
      .from(schema.signupRequests)
      .where(eq(schema.signupRequests.status, "pending"))
      .orderBy(desc(schema.signupRequests.createdAt));
  },

  async updateSignupRequest(id: string, data: Partial<InsertSignupRequest>): Promise<SignupRequest | undefined> {
    const [request] = await db
      .update(schema.signupRequests)
      .set(data)
      .where(eq(schema.signupRequests.id, id))
      .returning();
    return request;
  },

  async deleteSignupRequest(id: string): Promise<void> {
    await db.delete(schema.signupRequests).where(eq(schema.signupRequests.id, id));
  },

  // Password Reset Token operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(schema.passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return resetToken;
  },

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.token, token));
    return resetToken;
  },

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, id));
  },

  async deleteExpiredPasswordResetTokens(userId: string): Promise<void> {
    await db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, userId));
  },

  /**
   * Atomically add a user to a company with seat-based license checking.
   * Uses database-level row locking to prevent race conditions (TOCTOU vulnerability).
   * Checks role-specific seats: manager/admin vs tech (same logic for demo and paid).
   *
   * @param userId - The user ID to update
   * @param companyId - The company to add the user to
   * @param userData - Additional user data to update (must include role)
   * @returns Result object with success status and user or error message
   */
  async addUserToCompanyWithLicenseCheck(
    userId: string,
    companyId: string,
    userData: Partial<User>
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        // Lock the company row for update to prevent concurrent modifications
        const companyResult = await tx.execute(
          sql`SELECT * FROM companies WHERE id = ${companyId} FOR UPDATE`
        );

        const company = companyResult.rows[0] as any;
        if (!company) {
          return { success: false, error: "Company not found" };
        }

        // Verify company has valid access (active subscription or valid demo)
        const hasActiveSubscription = company.subscription_status === 'active' || company.subscription_status === 'trialing';
        const hasValidDemo = company.package_type === 'demo' && company.demo_expires_at && new Date(company.demo_expires_at) > new Date();

        if (!hasActiveSubscription && !hasValidDemo) {
          return {
            success: false,
            error: "Active subscription required. Please set up billing on the Billing page first.",
          };
        }

        // Use role-specific seats for both demo and paid companies
        {
          const userRole = userData.role || 'tech';
          const isManagerRole = userRole === 'admin' || userRole === 'manager';

          const purchasedSeats = isManagerRole
            ? (company.purchased_manager_seats || 0)
            : (company.purchased_tech_seats || 0);
          const roleLabel = isManagerRole ? 'manager/admin' : 'technician';

          // Count current users of this role type
          const userCountResult = isManagerRole
            ? await tx.execute(
                sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${companyId} AND (role = 'admin' OR role = 'manager')`
              )
            : await tx.execute(
                sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${companyId} AND role = 'tech'`
              );
          const currentRoleUsers = Number(userCountResult.rows[0]?.count || 0);

          // Count pending invitations for this role type
          const invitationCountResult = isManagerRole
            ? await tx.execute(
                sql`SELECT COUNT(*) as count FROM invitations WHERE company_id = ${companyId} AND status = 'pending' AND (role = 'admin' OR role = 'manager')`
              )
            : await tx.execute(
                sql`SELECT COUNT(*) as count FROM invitations WHERE company_id = ${companyId} AND status = 'pending' AND role = 'tech'`
              );
          const pendingRoleInvitations = Number(invitationCountResult.rows[0]?.count || 0);

          const totalUsed = currentRoleUsers + pendingRoleInvitations;

          // Check seat limit for this role
          if (totalUsed >= purchasedSeats) {
            return {
              success: false,
              error: `No available ${roleLabel} seats (${totalUsed}/${purchasedSeats} used). Please purchase more seats on the Billing page.`,
            };
          }
        }

        // Update user within the transaction
        const [updatedUser] = await tx
          .update(schema.users)
          .set({ ...userData, companyId, updatedAt: new Date() })
          .where(eq(schema.users.id, userId))
          .returning();

        return { success: true, user: updatedUser };
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { success: false, error: err.message };
    }
  },

  /**
   * Atomically create an invitation with seat-based license checking.
   * Counts both existing users and pending invitations against role-specific seats.
   * Same logic for demo and paid companies.
   *
   * @param companyId - The company to create the invitation for
   * @param invitationData - The invitation data (must include role)
   * @returns Result object with success status and invitation or error message
   */
  async createInvitationWithLicenseCheck(
    companyId: string,
    invitationData: InsertInvitation
  ): Promise<{ success: boolean; invitation?: Invitation; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        // Lock the company row for update
        const companyResult = await tx.execute(
          sql`SELECT * FROM companies WHERE id = ${companyId} FOR UPDATE`
        );

        const company = companyResult.rows[0] as any;
        if (!company) {
          return { success: false, error: "Company not found" };
        }

        // Verify company has valid access (active subscription or valid demo)
        const hasActiveSubscription = company.subscription_status === 'active' || company.subscription_status === 'trialing';
        const hasValidDemo = company.package_type === 'demo' && company.demo_expires_at && new Date(company.demo_expires_at) > new Date();

        if (!hasActiveSubscription && !hasValidDemo) {
          return {
            success: false,
            error: "Active subscription required. Please set up billing on the Billing page first.",
          };
        }

        // Use role-specific seats for both demo and paid companies
        {
          const inviteRole = invitationData.role || 'tech';
          const isManagerRole = inviteRole === 'admin' || inviteRole === 'manager';

          const purchasedSeats = isManagerRole
            ? (company.purchased_manager_seats || 0)
            : (company.purchased_tech_seats || 0);
          const roleLabel = isManagerRole ? 'manager/admin' : 'technician';

          // Count current users of this role type
          const userCountResult = isManagerRole
            ? await tx.execute(
                sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${companyId} AND (role = 'admin' OR role = 'manager')`
              )
            : await tx.execute(
                sql`SELECT COUNT(*) as count FROM users WHERE company_id = ${companyId} AND role = 'tech'`
              );
          const currentRoleUsers = Number(userCountResult.rows[0]?.count || 0);

          // Count pending invitations for this role type
          const invitationCountResult = isManagerRole
            ? await tx.execute(
                sql`SELECT COUNT(*) as count FROM invitations WHERE company_id = ${companyId} AND status = 'pending' AND (role = 'admin' OR role = 'manager')`
              )
            : await tx.execute(
                sql`SELECT COUNT(*) as count FROM invitations WHERE company_id = ${companyId} AND status = 'pending' AND role = 'tech'`
              );
          const pendingRoleInvitations = Number(invitationCountResult.rows[0]?.count || 0);

          const totalUsed = currentRoleUsers + pendingRoleInvitations;

          // Check seat limit for this role
          if (totalUsed >= purchasedSeats) {
            return {
              success: false,
              error: `No available ${roleLabel} seats (${totalUsed}/${purchasedSeats} used). Please purchase more seats on the Billing page.`,
            };
          }
        }

        // Create invitation within the transaction
        const [invitation] = await tx
          .insert(schema.invitations)
          .values(invitationData)
          .returning();

        return { success: true, invitation };
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return { success: false, error: err.message };
    }
  },
};
