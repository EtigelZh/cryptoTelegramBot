import { nouns } from "./words/nouns.const";
import { participles } from "./words/participles.const";
import { addjectivies } from "./words/addjectivies.const";

type Gender = 'male' | 'female' | 'neuter';

function determineGender(noun: string): Gender {
    const lastChar = noun[noun.length - 1].toLowerCase();
    const feminineEndings = ['а', 'я'];
    const neuterEndings = ['е', 'о'];

    if (feminineEndings.includes(lastChar)) {
        return 'female';
    } else if (neuterEndings.includes(lastChar)) {
        return 'neuter';
    } else {
        return 'male';
    }
}

function convertAdjective(adjective: string, targetGender: Gender): string {
    let root = adjective;
    let ending = '';

    // Логика для кратких и полных прилагательных, а также притяжательных форм
    if (targetGender === 'female') {
        if (adjective.endsWith('ый') || adjective.endsWith('ий') || adjective.endsWith('ой')) {
            root = adjective.slice(0, -2);
            ending = 'ая';
        } else if (adjective.endsWith('ен') || adjective.endsWith('ён') || adjective.endsWith('ан') || adjective.endsWith('ян')) {
            root = adjective.slice(0, -1);
            ending = 'а';
        }
    } else if (targetGender === 'neuter') {
        if (adjective.endsWith('ый') || adjective.endsWith('ий')) {
            root = adjective.slice(0, -2);
            ending = 'ое';
        } else if (adjective.endsWith('ой')) {
            root = adjective.slice(0, -2);
            ending = 'ее';
        } else if (adjective.endsWith('ен') || adjective.endsWith('ён') || adjective.endsWith('ан') || adjective.endsWith('ян')) {
            root = adjective.slice(0, -1);
            ending = 'о';
        }
    } else {
        return adjective;
    }

    return root + ending;
}

function convertParticiple(participle: string, targetGender: Gender): string {
    let root = participle;
    let ending = '';
    const isReflexive = participle.endsWith('ся'); // Проверка на возвратность

    // Удаление суффикса возвратности для дальнейшей обработки
    if (isReflexive) {
        root = root.slice(0, -2);
    }

    // Определение нового окончания в зависимости от целевого рода
    switch (targetGender) {
        case 'female':
            if (root.endsWith('ий') || root.endsWith('ый') || root.endsWith('ой')) {
                ending = 'ая';
            }
            break;
        case 'neuter':
            if (root.endsWith('ий') || root.endsWith('ый')) {
                ending = 'ое';
            } else if (root.endsWith('ой')) {
                ending = 'ее';
            } else if (root.endsWith('во')) {
                root = root.slice(0, -2); // Дополнительная обработка для окончания 'во'
                ending = 'во'; // Сохраняем окончание 'во', т.к. оно не меняется
            }
            break;
        default:
            return participle;
    }

    // Восстановление суффикса возвратности, если это необходимо
    if (isReflexive) {
        return root + ending + 'ся';
    } else {
        return root + ending;
    }
}

export async function humanizeHash(hash: string, checkCollision: (key:string) => Promise<boolean>): Promise<string> {
    // Определяем базовые индексы из хеш-значения
    const participlesIndex = parseInt(hash.slice(2, 6), 16) % participles.length;
    const addjectiviesIndex = parseInt(hash.slice(6, 10), 16) % addjectivies.length;
    const nounsIndex = parseInt(hash.slice(10, 14), 16) % nouns.length;
    const gender = determineGender(nouns[nounsIndex]);
    let key = [convertAdjective(addjectivies[addjectiviesIndex], gender), nouns[nounsIndex]].join(' ');
    let hasCollision = await checkCollision(key);
    let useParticiple = false;
    while (hasCollision) {
        if (!useParticiple) {
            key = [convertParticiple(participles[participlesIndex], gender),key].join(' ');
            useParticiple = true;
        } else {
            key = key + Math.floor(Math.random() * 10) % 10;
        }
        
        hasCollision = await checkCollision(key);
    }

    return key;
}