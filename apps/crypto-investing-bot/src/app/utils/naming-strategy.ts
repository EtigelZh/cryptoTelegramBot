import { Table } from 'typeorm';
import { Logger } from '@nestjs/common';

import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface {
  tableName(className: string, customName: string): string {
    return customName ? customName : snakeCase(className);
  }

  columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    return (
      snakeCase(embeddedPrefixes.concat('').join('_')) +
      (customName ? customName : snakeCase(propertyName))
    );
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName);
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return snakeCase(
      firstTableName +
        '_' +
        firstPropertyName.replace(/\./gi, '_') +
        '_' +
        secondTableName,
    );
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(
      tableName + '_' + (columnName ? columnName : propertyName),
    );
  }

  classTableInheritanceParentColumnName(
    parentTableName: any,
    parentTableIdPropertyName: any,
  ): string {
    return snakeCase(parentTableName + '_' + parentTableIdPropertyName);
  }

  eagerJoinRelationAlias(alias: string, propertyPath: string): string {
    return alias + '__' + propertyPath.replace('.', '_');
  }
}

export class NamingStrategy extends SnakeNamingStrategy {
  tableName(className: string, customName: string): string {
    let tableName = super.tableName(className, customName).replace('_entity', '');
    const lastSymbol = tableName[tableName.length - 1];
    if (lastSymbol === 'y') {
      tableName = tableName.substring(0, tableName.length - 1) + 'ie';
    }
    return tableName + 's';
  }

  extractName(tableOrName: Table | string): string {
    return typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
  }

  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    _referencedTablePath?: string,
    _referencedColumnNames?: string[]
  ): string {
    return this.replaceLongName(`FK_${this.extractName(tableOrName)}__${columnNames.sort().join('_')}___${_referencedTablePath}__${(_referencedColumnNames || []).join(
      '_'
    )}`);
  }

  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return this.replaceLongName(`PK_${this.extractName(tableOrName)}_${columnNames.sort().join('_')}`);
  }

  checkConstraintName(tableOrName: Table | string, expression: string, isEnum?: boolean): string {
    return this.replaceLongName(`CHK_${this.extractName(tableOrName)}_${expression}${isEnum ? '_ENUM' : ''}`);
  }

  relationConstraintName(tableOrName: Table | string, columnNames: string[], where?: string): string {
    return this.replaceLongName(`REL_${this.extractName(tableOrName)}__${columnNames.sort().join('_')}${where ? `__${where}` : ''}`);

  }

  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    return this.replaceLongName(`UQ_${this.extractName(tableOrName)}__${columnNames.sort().join('_')})`);
  }

  private replaceLongName(name: string): string {
    if (name.length < 64) {
      return name;
    }
    const relationName = name.replace(/___/g, '_').replace(/__/g, '_').split('_');
    let currentWord = relationName.length - 1;
    while (relationName.join('_').length > 63 && currentWord > 0) {
      relationName[currentWord] = this.cutWord(relationName[currentWord]);
      currentWord--;
    }

    if (relationName.join('_').length > 63) {
      Logger.warn(`TO long relation name ${relationName.join('_')}`);
      return relationName.join('_').substring(0, 63);
    }
    return relationName.join('_');
  }

  private cutWord(word: string): string {
    if (!word) {
      return '';
    }
    const [first, ...other] = word;
    return first + other.join('').replace(/[aeiouy]/gi, '');
  }
}
