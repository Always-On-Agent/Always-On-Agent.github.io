export type SearchableCampusPlace = { id: string; name: { en: string; zh: string }; aliases?: string[]; category?: string; mapVisible?: boolean }
const normalized = (value: string) => value.toLocaleLowerCase().normalize('NFKC').replace(/[\s_–—-]+/g, ' ').trim()
/** Search aliases as well as displayed names; compact spelling accepts Hall1 / Hall 1. */
export function searchCampusPlaces<T extends SearchableCampusPlace> (places: readonly T[], query: string): T[] {
  const q = normalized(query); const compact = q.replace(/\s/g, '')
  if (!q) return places.filter(place => place.mapVisible !== false)
  return places.map(place => {
    const labels = [place.name.en, place.name.zh, ...(place.aliases ?? [])].map(normalized)
    const score = Math.max(...labels.map(label => label === q ? 100 : label.replace(/\s/g, '') === compact ? 90 : label.startsWith(q) ? 65 : label.includes(q) ? 50 : label.replace(/\s/g, '').includes(compact) ? 30 : q.split(' ').every(word => label.includes(word)) ? 20 : 0))
    return { place, score }
  }).filter(value => value.score > 0).sort((a, b) => b.score - a.score).map(value => value.place)
}

export function campusPlaceCategory (category: string | undefined, language: 'en' | 'zh') {
  const labels: Record<string, [string, string]> = {
    residential: ['住宿', 'Residence'], building: ['楼宇', 'Building'], transport: ['交通站点', 'Transport'], room: ['房间', 'Room'],
    'point-of-interest': ['地点', 'Place'], lab: ['实验室', 'Lab'], health: ['医疗', 'Health'], parking: ['停车', 'Parking'], food: ['餐饮', 'Food'],
    service: ['服务', 'Service'], office: ['办公室', 'Office'], lecture: ['教室', 'Lecture'], study: ['自习', 'Study'], meeting: ['会议室', 'Meeting'], landmark: ['地标', 'Landmark']
  }
  return labels[category ?? '']?.[language === 'zh' ? 0 : 1] ?? (language === 'zh' ? '探索' : 'Explore')
}
