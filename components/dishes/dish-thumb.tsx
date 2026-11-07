import Image from 'next/image'
import { cn } from '@/lib/utils'
import { dishEmoji, dishTileHue } from '@/lib/dish-categories'

/**
 * 菜品缩略图：有图显示图；无图显示「分类 emoji + 柔和色块」。
 * 大多数家庭不会给每道菜拍照，统一的灰色碗图标一屏下来分不清谁是谁。
 */
export function DishThumb({
  name,
  imagePath,
  tags,
  sizes,
  className,
  emojiClassName,
}: {
  name: string
  imagePath: string | null
  tags: string[] | null
  /** next/image sizes */
  sizes: string
  className?: string
  emojiClassName?: string
}) {
  if (imagePath) {
    return (
      <div className={cn('relative overflow-hidden bg-trough', className)}>
        <Image
          src={`/api/uploads/${imagePath}`}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
    )
  }
  const hue = dishTileHue(name)
  return (
    <div
      aria-hidden
      className={cn('mf-dish-tile flex items-center justify-center', className)}
      style={{ '--tile-h': hue } as React.CSSProperties}
    >
      <span className={cn('select-none leading-none', emojiClassName)}>
        {dishEmoji(tags, name)}
      </span>
    </div>
  )
}
