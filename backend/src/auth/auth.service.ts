import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ user: Partial<User>; access_token: string }> {
    // Registration is ONLY allowed for 'user' role
    // Admin and Org roles must be created by admin through backend

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // organizationId is required in the request (can be null for independent users)
    // If user is registering with an organization, validate email template
    if (registerDto.organizationId) {
      const org = await this.organizationRepository.findOne({
        where: { id: registerDto.organizationId },
      });

      if (!org) {
        throw new ConflictException('Organization not found');
      }

      // If organization has email template, user MUST use org email
      if (org.emailTemplate) {
        const emailPattern = this.validateEmailTemplate(registerDto.email, org.emailTemplate);
        if (!emailPattern) {
          throw new ConflictException(
            `Email must match organization template: ${org.emailTemplate}. Example: username${org.emailTemplate}`
          );
        }
      }
    }
    // If organizationId is null, user is independent and can use any email

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user - always 'user' role for registration
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      role: UserRole.USER, // Always 'user' for registration
    });

    const savedUser = await this.userRepository.save(user);

    // Generate JWT token
    const payload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      organizationId: savedUser.organizationId,
    };

    const access_token = this.jwtService.sign(payload);

    // Remove password from response
    const { password, ...userWithoutPassword } = savedUser;

    return {
      user: userWithoutPassword,
      access_token,
    };
  }

  async login(loginDto: LoginDto): Promise<{ user: Partial<User>; access_token: string }> {
    // Find user with password field
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
      select: ['id', 'email', 'name', 'password', 'role', 'organizationId', 'createdAt'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const access_token = this.jwtService.sign(payload);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      access_token,
    };
  }

  async validateUser(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private validateEmailTemplate(email: string, template: string): boolean {
    // Template can be like "@abc.in" or "*@abc.in" or "*.@abc.in"
    // Convert template to regex pattern
    let pattern = template.replace(/\./g, '\\.'); // Escape dots
    pattern = pattern.replace(/\*/g, '.*'); // Replace * with regex .*
    
    // If pattern doesn't start with @, add it
    if (!pattern.startsWith('@')) {
      pattern = '@' + pattern;
    }
    
    // If pattern doesn't have a placeholder, add one
    if (!pattern.includes('.*')) {
      pattern = '.*' + pattern;
    }

    const regex = new RegExp(`^${pattern}$`, 'i');
    return regex.test(email);
  }
}
