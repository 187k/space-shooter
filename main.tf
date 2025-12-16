terraform {
  required_providers {
    yandex = {
      source = "yandex-cloud/yandex"
    }
  }
}

# --- НАСТРОЙКИ (Вставь свои данные сюда!) ---
provider "yandex" {
  token     = "ВСТАВЬ_СЮДА_ТОКЕН_ИЗ_КОНСОЛИ"     # Длинная строка y0_AgAA...
  cloud_id  = "ВСТАВЬ_СЮДА_CLOUD_ID"             # Строка типа b1g...
  folder_id = "ВСТАВЬ_СЮДА_FOLDER_ID"            # Строка типа b1g...
  zone      = "ru-central1-a"
}
# ---------------------------------------------

# 1. Создаем сеть
resource "yandex_vpc_network" "k8s-network" {
  name = "k8s-network"
}

# 2. Создаем подсеть (участок сети)
resource "yandex_vpc_subnet" "k8s-subnet" {
  name           = "k8s-subnet"
  zone           = "ru-central1-a"
  network_id     = yandex_vpc_network.k8s-network.id
  v4_cidr_blocks = ["10.1.0.0/16"]
}

# 3. Сервисный аккаунт (робот, который будет управлять кластером)
resource "yandex_iam_service_account" "k8s-sa" {
  name = "k8s-robot"
}

# Даем роботу права
resource "yandex_resourcemanager_folder_iam_member" "editor" {
  folder_id = "ВСТАВЬ_СЮДА_FOLDER_ID" # <--- И СЮДА ТОЖЕ ВСТАВЬ FOLDER_ID
  role      = "editor"
  member    = "serviceAccount:${yandex_iam_service_account.k8s-sa.id}"
}

resource "yandex_resourcemanager_folder_iam_member" "images-puller" {
  folder_id = "ВСТАВЬ_СЮДА_FOLDER_ID" # <--- И СЮДА ТОЖЕ
  role      = "container-registry.images.puller"
  member    = "serviceAccount:${yandex_iam_service_account.k8s-sa.id}"
}

# 4. Кластер Kubernetes (Головной мозг)
resource "yandex_kubernetes_cluster" "k8s-zonal" {
  name        = "snake-cluster"
  network_id  = yandex_vpc_network.k8s-network.id

  master {
    version = "1.27"
    zonal {
      zone      = "ru-central1-a"
      subnet_id = yandex_vpc_subnet.k8s-subnet.id
    }
    public_ip = true
  }

  service_account_id      = yandex_iam_service_account.k8s-sa.id
  node_service_account_id = yandex_iam_service_account.k8s-sa.id

  depends_on = [
    yandex_resourcemanager_folder_iam_member.editor,
    yandex_resourcemanager_folder_iam_member.images-puller
  ]
}

# 5. Рабочие узлы (Компьютеры, где будет жить змейка)
resource "yandex_kubernetes_node_group" "k8s-ng" {
  cluster_id  = yandex_kubernetes_cluster.k8s-zonal.id
  name        = "snake-nodes"
  version     = "1.27"

  instance_template {
    platform_id = "standard-v2"
    network_interface {
      nat                = true
      subnet_ids         = [yandex_vpc_subnet.k8s-subnet.id]
    }
    resources {
      memory = 2
      cores  = 2
    }
  }

  scale_policy {
    fixed_scale {
      size = 1
    }
  }
}

# 6. Реестр контейнеров (Склад для Docker-образов)
resource "yandex_container_registry" "my-reg" {
  name = "snake-registry"
}

# Вывод полезной инфы после создания
output "cluster_id" {
  value = yandex_kubernetes_cluster.k8s-zonal.id
}

output "registry_id" {
  value = yandex_container_registry.my-reg.id
}
