import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async create(createUserDto: CreateUserDto, requestingUser?: User): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate role assignment - only admin can create org admins
    if (createUserDto.role === UserRole.ORG) {
      if (!requestingUser || requestingUser.role !== UserRole.ADMIN) {
        throw new ConflictException('Only system admins can create organization admins');
      }
    }

    if (createUserDto.role === UserRole.ADMIN) {
      // Check if admin already exists
      const existingAdmin = await this.userRepository.findOne({
        where: { role: UserRole.ADMIN },
      });
      if (existingAdmin) {
        throw new ConflictException('An admin already exists. Only one admin is allowed.');
      }
    }

    // If user has organization, validate email template
    if (createUserDto.organizationId) {
      const org = await this.organizationRepository.findOne({
        where: { id: createUserDto.organizationId },
      });

      if (!org) {
        throw new ConflictException('Organization not found');
      }

      if (org.emailTemplate) {
        const emailPattern = this.validateEmailTemplate(createUserDto.email, org.emailTemplate);
        if (!emailPattern) {
          throw new ConflictException(
            `Email must match organization template: ${org.emailTemplate}. Example: username${org.emailTemplate}`
          );
        }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Set default role if not provided
    const userData = {
      ...createUserDto,
      password: hashedPassword,
      role: createUserDto.role || UserRole.USER,
    };
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  private validateEmailTemplate(email: string, template: string): boolean {
    // Template can be like "@abc.in" or "*@abc.in" or "*.@abc.in"
    let pattern = template.replace(/\./g, '\\.'); // Escape dots
    pattern = pattern.replace(/\*/g, '.*'); // Replace * with regex .*
    
    if (!pattern.startsWith('@')) {
      pattern = '@' + pattern;
    }
    
    if (!pattern.includes('.*')) {
      pattern = '.*' + pattern;
    }

    const regex = new RegExp(`^${pattern}$`, 'i');
    return regex.test(email);
  }

  async findAll(organizationId?: string, search?: string): Promise<User[]> {
    if (search && search.trim()) {
      if (organizationId) {
        return this.userRepository.find({
          where: [
            { organizationId, name: ILike(`%${search.trim()}%`) },
            { organizationId, email: ILike(`%${search.trim()}%`) },
          ],
          relations: ['organization'],
        });
      }
      return this.userRepository.find({
        where: [
          { name: ILike(`%${search.trim()}%`) },
          { email: ILike(`%${search.trim()}%`) },
        ],
        relations: ['organization'],
      });
    }
    
    if (organizationId) {
      return this.userRepository.find({ 
        where: { organizationId },
        relations: ['organization'],
      });
    }
    return this.userRepository.find({
      relations: ['organization'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['organization'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}
